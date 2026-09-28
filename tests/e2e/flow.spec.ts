import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, who: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(who) }).click();
  await page.waitForURL(/\/(today|minutes)/);
}

test("therapist dictates, reviews, and signs a session", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.locator("select[name=student]").selectOption({ label: "Ava Morales" });
  await page.getByRole("button", { name: "Log session" }).last().click();
  await page.waitForURL(/\/capture/);
  await page.locator("textarea[name=transcript]").fill(
    "Twenty five minutes one-on-one. Practiced initial r words with picture cards, 7 out of 10 with minimal verbal cues. Followed two-step directions 4 of 5 trials independently. Next session r blends.",
  );
  await page.getByRole("button", { name: "Draft note" }).click();
  await page.waitForURL(/\/review\/enc_/);
  await expect(page.locator("input[name=minutes]")).toHaveValue("25");
  await expect(page.getByText("No problems found")).toBeVisible();
  await expect(page.getByText("Code 92507")).toBeVisible();
  await page.getByLabel(/I personally provided this service/).check();
  await page.getByRole("button", { name: "Sign note" }).click();
  await page.waitForURL(/\/review$/);
});

test("missing minutes block signing until entered", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.locator("select[name=student]").selectOption({ label: "Ava Morales" });
  await page.getByRole("button", { name: "Log session" }).last().click();
  await page.locator("textarea[name=transcript]").fill("Initial r words 9 out of 10 with minimal cues.");
  await page.getByRole("button", { name: "Draft note" }).click();
  await page.waitForURL(/\/review\/enc_/);
  await expect(page.getByText("Actual session minutes are missing.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign note" })).toBeDisabled();
  await page.locator("input[name=minutes]").fill("30");
  await page.getByRole("button", { name: "Save and re-check" }).click();
  await expect(page.getByText("Saved. Checks re-ran.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign note" })).toBeEnabled();
});

test("assistant note waits for supervisor co-sign", async ({ page, browser }) => {
  await login(page, "Jordan Reyes");
  await page.locator("select[name=student]").selectOption({ label: "Noah Kim" });
  await page.getByRole("button", { name: "Log session" }).last().click();
  await page.locator("textarea[name=transcript]").fill("30 minutes one-on-one. S blends in phrases 6 out of 10 with moderate cues.");
  await page.getByRole("button", { name: "Draft note" }).click();
  await page.waitForURL(/\/review\/enc_/);
  const url = page.url();
  await page.getByLabel(/I personally provided this service/).check();
  await page.getByRole("button", { name: "Sign note" }).click();
  await page.goto(url);
  await expect(page.getByText("Awaiting co-sign").first()).toBeVisible();

  const sup = await browser.newPage();
  await login(sup, "Maya Chen");
  await sup.goto(url);
  await sup.getByLabel(/I reviewed this note/).check();
  await sup.getByRole("button", { name: "Co-sign" }).click();
  await sup.goto(url);
  await expect(sup.getByText("Billable").first()).toBeVisible();
});

test("coordinator sees district minutes and exports claims", async ({ page }) => {
  await login(page, "Dana Whitfield");
  await expect(page.getByRole("heading", { name: "IEP minutes" })).toBeVisible();
  await expect(page.getByText("Sessions never logged")).toBeVisible();
  const res = await page.request.get("/api/claims");
  expect(res.status()).toBe(200);
  const csv = await res.text();
  expect(csv.split("\n")[0]).toContain("procedure_code");
  expect(csv.split("\n").length).toBeGreaterThan(2);
});

test("digest never names students", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.goto("/digest");
  const text = await page.locator("article").innerText();
  for (const n of ["Ava", "Morales", "Sofia", "Mateo", "Elijah", "Jayden", "Liam"]) expect(text).not.toContain(n);
});

test("one group dictation becomes a note per student", async ({ page }) => {
  await login(page, "Maya Chen");
  const ids = ["stu_elijah", "stu_jayden", "stu_liam"];
  await page.goto(`/capture/group?students=${ids.join(",")}&scheduled=30`);
  await page.getByRole("button", { name: "Liam Johnson" }).click();
  await page.locator("textarea[name=transcript]").fill(
    "30 minutes playing a turn-taking board game. Elijah kept the conversation topic for 3 turns 4 of 5 opportunities with minimal cues. Jayden kept the topic 2 of 5 turns with moderate cues.",
  );
  await page.getByRole("button", { name: /Draft 2 notes and log 1 absence/ }).click();
  await page.waitForURL(/\/review\?group=/);
  await expect(page.getByText(/drafted as 3 separate notes/)).toBeVisible();
  await page.getByRole("link", { name: /Elijah Brown/ }).filter({ has: page.locator(".chip", { hasText: /^Group$/ }) }).first().click();
  await expect(page.locator("input[name=group_size]")).toHaveValue("2");
  await expect(page.locator("input[name=minutes]")).toHaveValue("30");
  await expect(page.getByText("Code 92508")).toBeVisible();
});

test("progress report drafts from session data and locks when signed", async ({ page }) => {
  await login(page, "Maya Chen");
  await page.goto("/progress");
  await page.getByRole("link", { name: /Morales, Ava/ }).click();
  await expect(page.getByRole("heading", { name: /IEP Progress Report/ })).toBeVisible();
  const narrative = page.locator("textarea[name^=narrative_]").first();
  await expect(narrative).toHaveValue(/sessions|data/);
  await page.getByRole("button", { name: "Finalize and sign" }).click();
  await expect(page.getByText("Check the attestation box")).toBeVisible();
  await page.getByLabel(/I reviewed this report/).check();
  await page.getByRole("button", { name: "Finalize and sign" }).click();
  await expect(page.getByText(/Signed by Maya Chen/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByRole("link", { name: /Morales, Ava/ }).getByText("Finalized")).toBeVisible();
});

test("audit binder shows proof for each claimable session", async ({ page }) => {
  await login(page, "Dana Whitfield");
  await page.goto("/claims");
  await page.getByRole("link", { name: "Audit binder" }).click();
  await expect(page.getByRole("heading", { name: "Audit binder" })).toBeVisible();
  const first = page.locator("article").first();
  await expect(first.getByText(/Parental billing consent: signed/)).toBeVisible();
  await expect(first.getByText("All checks passed.")).toBeVisible();
  await expect(first.getByText(/NPI \d{10} \(valid\)/).first()).toBeVisible();
});

test("coordinator switches state rules and notes re-check", async ({ page }) => {
  await login(page, "Dana Whitfield");
  await page.goto("/settings");
  await expect(page.getByText("Illinois rules Sessionside enforces")).toBeVisible();
  await page.locator("select[name=state]").selectOption("TX");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Texas rules Sessionside enforces")).toBeVisible();
  await expect(page.getByText(/7 days, late notes not claimable/)).toBeVisible();
  await page.locator("select[name=state]").selectOption("IL");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Illinois rules Sessionside enforces")).toBeVisible();
});

test("service log export includes absences for the IEP system", async ({ page }) => {
  await login(page, "Maya Chen");
  const res = await page.request.get("/api/exports?profile=service-log&from=2026-01-01&to=2030-01-01");
  expect(res.status()).toBe(200);
  const lines = (await res.text()).trim().split("\n");
  expect(lines[0]).toBe("Date,Last Name,First Name,Service,Attendance,Minutes,Setting,Group Size,Provider,Goals Addressed,Progress");
  expect(lines.length).toBeGreaterThan(5);
});
