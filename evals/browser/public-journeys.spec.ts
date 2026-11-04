import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  const permitted = new URL(baseURL!).origin;
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== permitted) return route.abort(); // No analytics, AI, auth, chain or customer traffic.
    await route.continue();
  });
});

test("public privacy and deletion journeys expose their promised controls", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /AI Processing/ })).toBeVisible();
  await page.goto("/account-deletion");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/delet/i);
  await expect(page.getByRole("link", { name: /profile|account|sign in/i }).first()).toBeVisible();
});

test("anonymous recording presents an explicit authentication boundary", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { level: 1, name: "Sign In to Record" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save Privately$/ })).toHaveCount(0);
});
