import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, who: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(who) }).click();
  await page.waitForURL(/\/(today|minutes)/);
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`);
}

for (const path of ["/login", "/trust"]) {
  test(`public ${path} meets WCAG 2.1 AA`, async ({ page }) => {
    await page.goto(path);
    expect(await scan(page)).toEqual([]);
  });
}

const therapistPages = ["/today", "/review", "/minutes", "/minutes/ledger", "/progress", "/claims", "/exports", "/students", "/digest", "/capture?student=stu_ava"];

for (const path of therapistPages) {
  test(`therapist ${path} meets WCAG 2.1 AA`, async ({ page }) => {
    await login(page, "Maya Chen");
    await page.goto(path);
    expect(await scan(page)).toEqual([]);
  });
}

test("note review meets WCAG 2.1 AA", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.goto("/review");
  await page.locator("a[href^='/review/enc_']").first().click();
  await page.waitForURL(/\/review\/enc_/);
  expect(await scan(page)).toEqual([]);
});

for (const path of ["/settings", "/claims/binder", "/students/stu_ava"]) {
  test(`coordinator ${path} meets WCAG 2.1 AA`, async ({ page }) => {
    await login(page, "Dana Whitfield");
    await page.goto(path);
    expect(await scan(page)).toEqual([]);
  });
}

test("keyboard users can skip to main content", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
