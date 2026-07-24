import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WATCH_BATCH_SIZE } from "./config";
import { fetchSource } from "./fetch-source";
import { normalizeHtml } from "./normalize-html";
import { normalizePdf } from "./normalize-pdf";
import { hashDocument, hashSection } from "./section-hash";
import { computeChangeGate, hasChanges } from "./change-gate";
import { loadRecordSnapshot } from "./load-record";
import { runExtraction } from "./run-extraction";
import { scoreConfidence } from "./score-confidence";
import { upsertSuggestions, type ScoredProposal } from "./upsert-suggestions";
import type { CitableSection, NormalizedSection, StoredSection } from "./types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// The agentic source-watcher loop, one legible place. Per scholarship it runs
// the full cycle:
//   perceive (fetch + normalize) -> detect change (deterministic hash gate)
//   -> retrieve evidence (changed sections + live record) -> reason (RAG
//   extraction) -> diff -> score -> act (file suggestions) -> [human approval].
// The human-approval gate lives in lib/actions/suggestions.ts; nothing here
// ever writes to real scholarship data.

export interface WatchRunSummary {
  processed: number;
  changed: number;
  suggestionsWritten: number;
  failures: number;
}

interface WatchTarget {
  id: string;
  official_url: string;
}

function toStoredSections(rows: Array<Record<string, unknown>> | null | undefined): StoredSection[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    sectionIndex: Number(r.section_index),
    headingLabel: (r.heading_label as string | null) ?? null,
    sectionHash: String(r.section_hash),
    sectionText: String(r.section_text),
  }));
}

async function normalize(
  body: Buffer,
  sourceKind: "html" | "pdf",
  url: string
): Promise<NormalizedSection[]> {
  return sourceKind === "pdf" ? normalizePdf(body) : normalizeHtml(body.toString("utf-8"), url);
}

async function processScholarship(supabase: AdminClient, target: WatchTarget): Promise<{
  changed: boolean;
  suggestionsWritten: number;
  failure: boolean;
}> {
  const fetched = await fetchSource(target.official_url);

  // Record the failure and move on -- a persistently broken official_url should
  // surface (a curator can see repeated failures), never crash the batch.
  if (!fetched.ok) {
    await supabase.from("source_documents").insert({
      scholarship_id: target.id,
      source_url: target.official_url,
      source_kind: "html",
      http_status: fetched.httpStatus ?? null,
      fetch_error: fetched.error,
    });
    return { changed: false, suggestionsWritten: 0, failure: true };
  }

  const sections = await normalize(fetched.body, fetched.sourceKind, fetched.finalUrl);
  if (sections.length === 0) {
    await supabase.from("source_documents").insert({
      scholarship_id: target.id,
      source_url: fetched.finalUrl,
      source_kind: fetched.sourceKind,
      http_status: fetched.httpStatus,
      fetch_error: "No readable content extracted.",
    });
    return { changed: false, suggestionsWritten: 0, failure: true };
  }

  const sectionHashes = sections.map((s) => hashSection(s.text));
  const contentHash = hashDocument(sectionHashes);

  // Load the previous successful snapshot to diff against.
  const { data: prevDoc } = await supabase
    .from("source_documents")
    .select("id, content_hash, source_sections ( id, section_index, heading_label, section_hash, section_text )")
    .eq("scholarship_id", target.id)
    .not("content_hash", "is", null)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousSections = toStoredSections(
    (prevDoc as { source_sections?: Array<Record<string, unknown>> } | null)?.source_sections
  );

  // First-ever successful fetch: establish a baseline, don't file suggestions
  // (there is nothing to diff against yet).
  if (!prevDoc) {
    await insertDocumentWithSections(supabase, target, fetched, contentHash, sections, sectionHashes);
    return { changed: false, suggestionsWritten: 0, failure: false };
  }

  const gate = computeChangeGate(previousSections, sections);
  if (!hasChanges(gate)) {
    // Nothing changed: just touch the previous doc's fetched_at, no new rows,
    // no LLM call -- the cost-control path.
    await supabase
      .from("source_documents")
      .update({ fetched_at: new Date().toISOString() })
      .eq("id", (prevDoc as { id: string }).id);
    return { changed: false, suggestionsWritten: 0, failure: false };
  }

  // Something changed: persist the new baseline + sections, then extract only
  // over the changed/added sections.
  const { documentId, idBySectionIndex } = await insertDocumentWithSections(
    supabase,
    target,
    fetched,
    contentHash,
    sections,
    sectionHashes
  );

  const changedSections: CitableSection[] = [...gate.changed.map((c) => c.section), ...gate.added]
    .map((s) => {
      const id = idBySectionIndex.get(s.sectionIndex);
      return id ? { id, headingLabel: s.headingLabel, text: s.text } : null;
    })
    .filter((s): s is CitableSection => s !== null);

  const record = await loadRecordSnapshot(supabase, target.id);
  if (!record) return { changed: true, suggestionsWritten: 0, failure: false };

  const proposals = await runExtraction(record, changedSections);
  const scored: ScoredProposal[] = proposals.map((proposal) => ({
    proposal,
    confidence: scoreConfidence(proposal),
  }));

  const { written, failed } = await upsertSuggestions(supabase, documentId, scored);
  // A suggestion write failure is a genuine failure worth surfacing in the run
  // summary, not silently indistinguishable from "nothing to write"
  // (docs/QA-CHECKLIST.md P2-09) -- upsertSuggestions already logs the
  // per-row detail.
  return { changed: true, suggestionsWritten: written, failure: failed > 0 };
}

async function insertDocumentWithSections(
  supabase: AdminClient,
  target: WatchTarget,
  fetched: { finalUrl: string; sourceKind: "html" | "pdf"; httpStatus: number; body: Buffer },
  contentHash: string,
  sections: NormalizedSection[],
  sectionHashes: string[]
): Promise<{ documentId: string; idBySectionIndex: Map<number, string> }> {
  const { data: doc, error } = await supabase
    .from("source_documents")
    .insert({
      scholarship_id: target.id,
      source_url: fetched.finalUrl,
      source_kind: fetched.sourceKind,
      http_status: fetched.httpStatus,
      content_hash: contentHash,
      raw_byte_size: fetched.body.length,
    })
    .select("id")
    .single();

  if (error || !doc) throw new Error(`Failed to record source document: ${error?.message}`);
  const documentId = doc.id as string;

  const sectionRows = sections.map((s, i) => ({
    source_document_id: documentId,
    section_index: s.sectionIndex,
    heading_label: s.headingLabel,
    section_hash: sectionHashes[i],
    section_text: s.text,
    char_count: s.text.length,
  }));

  const idBySectionIndex = new Map<number, string>();
  if (sectionRows.length > 0) {
    const { data: inserted, error: sectionError } = await supabase
      .from("source_sections")
      .insert(sectionRows)
      .select("id, section_index");
    if (sectionError) throw new Error(`Failed to record source sections: ${sectionError.message}`);
    for (const row of (inserted ?? []) as Array<{ id: string; section_index: number }>) {
      idBySectionIndex.set(row.section_index, row.id);
    }
  }

  return { documentId, idBySectionIndex };
}

export async function runSourceWatcher(supabase: AdminClient): Promise<WatchRunSummary> {
  // Published scholarships are the watch targets. Order by staleness (oldest
  // last-fetch first) so the batch round-robins as the catalogue grows.
  const { data: scholarships, error } = await supabase
    .from("scholarships")
    .select("id, official_url")
    .eq("is_published", true);
  if (error) throw new Error("Failed to load scholarships to watch.");

  const targets = (scholarships ?? []) as WatchTarget[];

  // Latest fetch time per scholarship, to prioritise the most stale.
  const { data: docs } = await supabase
    .from("source_documents")
    .select("scholarship_id, fetched_at")
    .order("fetched_at", { ascending: false });

  const latestFetch = new Map<string, string>();
  for (const d of (docs ?? []) as Array<{ scholarship_id: string; fetched_at: string }>) {
    if (!latestFetch.has(d.scholarship_id)) latestFetch.set(d.scholarship_id, d.fetched_at);
  }

  const batch = targets
    .filter((t) => t.official_url)
    .sort((a, b) => {
      const av = latestFetch.get(a.id) ?? ""; // never-fetched sorts first
      const bv = latestFetch.get(b.id) ?? "";
      return av.localeCompare(bv);
    })
    .slice(0, WATCH_BATCH_SIZE);

  const summary: WatchRunSummary = { processed: 0, changed: 0, suggestionsWritten: 0, failures: 0 };

  for (const target of batch) {
    try {
      const result = await processScholarship(supabase, target);
      summary.processed += 1;
      if (result.changed) summary.changed += 1;
      if (result.failure) summary.failures += 1;
      summary.suggestionsWritten += result.suggestionsWritten;
    } catch {
      // One scholarship failing must not abort the batch.
      summary.failures += 1;
    }
  }

  return summary;
}
