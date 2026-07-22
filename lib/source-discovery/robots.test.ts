import { describe, expect, it } from "vitest";
import { parseRobots, isPathAllowed, PERMISSIVE_RULES } from "./robots";

const TOKEN = "iskolarmatch-discovery";

describe("parseRobots", () => {
  it("returns permissive rules for empty content", () => {
    const rules = parseRobots("", TOKEN);
    expect(rules.disallow).toEqual([]);
    expect(rules.allow).toEqual([]);
  });

  it("applies the wildcard group when no specific UA group matches", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private\n", TOKEN);
    expect(rules.disallow).toEqual(["/private"]);
  });

  it("prefers a UA-specific group over the wildcard group", () => {
    const txt = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: IskolarMatch-Discovery",
      "Disallow: /admin",
      "Crawl-delay: 3",
    ].join("\n");
    const rules = parseRobots(txt, TOKEN);
    expect(rules.disallow).toEqual(["/admin"]); // not the wildcard "/"
    expect(rules.crawlDelaySeconds).toBe(3);
  });

  it("merges consecutive user-agent lines into one group", () => {
    const txt = ["User-agent: googlebot", "User-agent: *", "Disallow: /x"].join("\n");
    const rules = parseRobots(txt, TOKEN);
    expect(rules.disallow).toEqual(["/x"]);
  });

  it("ignores comments and blank lines", () => {
    const txt = ["# a comment", "User-agent: *", "Disallow: /p # inline"].join("\n");
    expect(parseRobots(txt, TOKEN).disallow).toEqual(["/p"]);
  });
});

describe("isPathAllowed", () => {
  it("allows everything under permissive rules", () => {
    expect(isPathAllowed(PERMISSIVE_RULES, "/anything")).toBe(true);
  });

  it("blocks a disallowed prefix", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private", TOKEN);
    expect(isPathAllowed(rules, "/private/page")).toBe(false);
    expect(isPathAllowed(rules, "/public/page")).toBe(true);
  });

  it("treats an empty Disallow value as allow-all", () => {
    const rules = parseRobots("User-agent: *\nDisallow:", TOKEN);
    expect(isPathAllowed(rules, "/anything")).toBe(true);
  });

  it("lets a more specific Allow override a broader Disallow", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /docs\nAllow: /docs/public", TOKEN);
    expect(isPathAllowed(rules, "/docs/secret")).toBe(false);
    expect(isPathAllowed(rules, "/docs/public/x")).toBe(true);
  });

  it("supports * wildcards and $ end-anchors", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /*.pdf$", TOKEN);
    expect(isPathAllowed(rules, "/files/report.pdf")).toBe(false);
    expect(isPathAllowed(rules, "/files/report.pdf?x=1")).toBe(true); // $ anchors the end
    expect(isPathAllowed(rules, "/files/page.html")).toBe(true);
  });
});
