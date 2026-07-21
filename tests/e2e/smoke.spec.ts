import { expect, test } from "@playwright/test";

test.describe("public, DB-independent pages", () => {
  test("landing page renders the hero and links to /match", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /find what you actually qualify for/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /find my scholarships/i })).toHaveAttribute("href", "/match");
  });

  test("landing page footer links to /saved and /about", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Saved", exact: true })).toHaveAttribute("href", "/saved");
    await expect(page.getByRole("link", { name: "How it works", exact: true })).toHaveAttribute("href", "/about");
  });

  test("/match shows the profile form with semantic fieldsets", async ({ page }) => {
    await page.goto("/match");
    await expect(page.getByRole("heading", { name: /a few quick questions/i })).toBeVisible();
    await expect(page.getByText("Nothing is saved")).toBeVisible();

    // Education level is a real radio group with a legend, not just styled divs.
    const educationGroup = page.getByRole("group", { name: /education level/i });
    await expect(educationGroup.getByRole("radio", { name: /college student/i })).toBeVisible();
    await expect(educationGroup.getByRole("radio", { name: /senior high graduate/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /show my matches/i })).toBeVisible();
  });

  test("/match rejects an out-of-range GWA without hitting the database", async ({ page }) => {
    await page.goto("/match");
    await page.getByLabel(/gwa/i).fill("150");
    await page.getByRole("button", { name: /show my matches/i }).click();
    await expect(page.getByText(/enter a gwa between 0 and 100/i)).toBeVisible();
  });

  test("/about renders the how-it-works steps", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /how it works/i })).toBeVisible();
  });

  test("/privacy renders the RA 10173-aligned notice", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy, in plain language/i })).toBeVisible();
    await expect(page.getByText(/Data Privacy Act/i)).toBeVisible();
  });

  test("security headers are present on every response", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
  });
});
