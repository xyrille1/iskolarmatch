// Minimal ambient types for pdf-parse, which ships no bundled declarations.
// Only the surface lib/source-watcher/normalize-pdf.ts uses is declared.
declare module "pdf-parse" {
  interface PdfParseOptions {
    // Called once per page; return the string to accumulate into `.text`.
    pagerender?: (pageData: unknown) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdf(dataBuffer: Buffer | Uint8Array, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default pdf;
}
