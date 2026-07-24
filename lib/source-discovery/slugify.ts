// Pure slug helper used to pre-fill the promote form's slug from a candidate's
// title. The curator can edit it; this just saves typing. Output always matches
// scholarshipUpsertSchema's /^[a-z0-9-]+$/ (or is empty, which the curator
// fills in). Pure and I/O-free, so it unit-tests like the rest of lib/*.

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric -> hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 80);
}
