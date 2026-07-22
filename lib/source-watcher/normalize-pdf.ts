import "server-only";
import pdf from "pdf-parse";
import type { NormalizedSection } from "./types";

// Turn a fetched PDF into per-page sections. gov.ph / CHED / DOST-SEI circulars
// are frequently PDFs and rarely carry extractable semantic headings, so the
// deterministic default is one section per page labelled "Page N". pdf-parse is
// pure-JS (wraps pdf.js) with no native binary, so it runs on Vercel's Node
// runtime.

interface PdfTextItem {
  str: string;
}
interface PdfPageData {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

export async function normalizePdf(buffer: Buffer): Promise<NormalizedSection[]> {
  const pages: string[] = [];

  await pdf(buffer, {
    // pdf-parse invokes this once per page; collect each page's text in order.
    pagerender: async (pageData: unknown) => {
      const content = await (pageData as PdfPageData).getTextContent();
      const pageText = content.items
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(pageText);
      return pageText;
    },
  });

  return pages
    .map((text, index) => ({ text, index }))
    .filter(({ text }) => text.length > 0)
    .map(({ text }, i) => ({
      sectionIndex: i,
      headingLabel: `Page ${i + 1}`,
      text,
    }));
}
