import "server-only";
import { PDFParse } from "pdf-parse";
import type { NormalizedSection } from "./types";

// Turn a fetched PDF into per-page sections. gov.ph / CHED / DOST-SEI circulars
// are frequently PDFs and rarely carry extractable semantic headings, so the
// deterministic default is one section per page labelled "Page N". pdf-parse is
// pure-JS (wraps pdf.js) with no native binary, so it runs on Vercel's Node
// runtime.

export async function normalizePdf(buffer: Buffer): Promise<NormalizedSection[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages
      .map((page) => page.text.replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0)
      .map((text, i) => ({
        sectionIndex: i,
        headingLabel: `Page ${i + 1}`,
        text,
      }));
  } finally {
    await parser.destroy();
  }
}
