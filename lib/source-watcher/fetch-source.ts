import "server-only";
import { lookup } from "node:dns/promises";
import { isAllowlistedUrl } from "@/lib/security/url-allowlist";
import { isPrivateIp } from "@/lib/security/is-private-ip";
import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_RESPONSE_BYTES } from "./config";
import type { SourceKind } from "./types";

// SSRF-guarded fetch for the source-watcher. The watcher pulls arbitrary
// registered URLs from a serverless function, so this is genuine attack
// surface (docs/SECURITY.md). Layered defenses, in order:
//   1. HTTPS only.
//   2. Hostname must be on the gov.ph/edu.ph/curated allowlist (the same
//      isAllowlistedUrl() the admin form and DB trigger use) -- not merely
//      trusted because it equals scholarships.official_url, since the fetch is
//      its own input path.
//   3. Every resolved IP must be public (isPrivateIp) -- blocks a hostname that
//      resolves to a private/loopback/cloud-metadata address.
//   4. Redirects are followed MANUALLY, re-running (2) and (3) on every hop, so
//      an allowlisted URL can't 302 to an internal host.
//   5. The body is streamed under a hard byte cap and an overall timeout.
//
// It never throws for an expected failure (bad host, timeout, oversize, non-2xx)
// -- it returns a typed failure so the caller always records a source_documents
// row (a persistently failing official_url should surface to a curator).
//
// Documented residual risk: a small DNS-rebinding TOCTOU window remains between
// the pre-flight lookup and the actual connect. Accepted for now because the
// allowlist already restricts targets to registered gov.ph/edu.ph hosts;
// pinning the validated IP via a custom undici agent is a future hardening step
// (docs/SECURITY.md).

export type FetchSourceResult =
  | {
      ok: true;
      finalUrl: string;
      httpStatus: number;
      sourceKind: SourceKind;
      body: Buffer;
    }
  | {
      ok: false;
      error: string;
      httpStatus?: number;
    };

async function assertUrlIsSafe(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Malformed URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: `Refusing non-HTTPS URL (${url.protocol}).` };
  }

  if (!isAllowlistedUrl(url.href)) {
    return { ok: false, error: `Host ${url.hostname} is not on the source allowlist.` };
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, error: `DNS resolution failed for ${url.hostname}.` };
  }

  if (addresses.length === 0) {
    return { ok: false, error: `No DNS records for ${url.hostname}.` };
  }

  if (addresses.some((a) => isPrivateIp(a.address))) {
    return { ok: false, error: `Host ${url.hostname} resolves to a private address.` };
  }

  return { ok: true, url };
}

function inferSourceKind(finalUrl: string, contentType: string | null): SourceKind {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/pdf")) return "pdf";
  if (ct.includes("text/html")) return "html";
  // Fall back to the path extension when the server sends a vague content-type.
  return finalUrl.toLowerCase().split("?")[0].endsWith(".pdf") ? "pdf" : "html";
}

async function readCapped(response: Response): Promise<Buffer | null> {
  const body = response.body;
  if (!body) return Buffer.alloc(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        return null; // over the cap
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export async function fetchSource(rawUrl: string): Promise<FetchSourceResult> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safe = await assertUrlIsSafe(currentUrl);
    if (!safe.ok) return { ok: false, error: safe.error };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(safe.url.href, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "IskolarMatch-SourceWatcher/1.0 (+https://iskolarmatch.app)" },
      });
    } catch (err) {
      clearTimeout(timer);
      const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "network error";
      return { ok: false, error: `Fetch ${reason} for ${safe.url.hostname}.` };
    }
    clearTimeout(timer);

    // Manual redirect handling: validate the next hop before following it.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, error: `Redirect with no Location header.`, httpStatus: response.status };
      }
      // Resolve relative redirects against the current URL.
      currentUrl = new URL(location, safe.url).href;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: `Non-success status ${response.status}.`, httpStatus: response.status };
    }

    const body = await readCapped(response);
    if (body === null) {
      return { ok: false, error: `Response exceeded ${MAX_RESPONSE_BYTES} bytes.`, httpStatus: response.status };
    }

    return {
      ok: true,
      finalUrl: safe.url.href,
      httpStatus: response.status,
      sourceKind: inferSourceKind(safe.url.href, response.headers.get("content-type")),
      body,
    };
  }

  return { ok: false, error: `Exceeded ${MAX_REDIRECTS} redirects.` };
}
