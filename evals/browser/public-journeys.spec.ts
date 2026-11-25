import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context, baseURL }) => {
  const permitted = new URL(baseURL!).origin;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== permitted) return route.abort(); // No analytics, AI, auth, chain or customer traffic.
    await route.continue();
  });
});

test("public privacy and deletion journeys expose their promised controls", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacy Policy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /AI Processing/ }),
  ).toBeVisible();
  await page.goto("/account-deletion");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/delet/i);
  await expect(
    page.getByRole("link", { name: /profile|account|sign in/i }).first(),
  ).toBeVisible();
});

test("anonymous recording presents an explicit authentication boundary", async ({
  page,
}) => {
  await page.goto("/record");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign In to Record" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Save Privately$/ }),
  ).toHaveCount(0);
});

test("standard login exposes Google and optional wallet access", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with a wallet" }),
  ).toBeVisible();
  await expect(page.getByText(/No wallet needed/).last()).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign up", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your eStories account" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Log in to eStories" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog")).toContainText("Continue with Google");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeFocused();
});

for (const width of [320, 390, 768, 1440]) {
  test(`homepage fits ${width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Essential only" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Essential only" }).click();
    const signup = page.getByRole("button", { name: "Sign up", exact: true });
    await expect(signup).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeVisible();
    await signup.click();
    await expect(
      page.getByRole("heading", { name: "Create your eStories account" }),
    ).toBeVisible();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await expect(signup).toBeFocused();
    const faq = page.getByRole("button", {
      name: "Do I need a crypto wallet?",
    });
    await faq.click();
    await expect(faq).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/No! Sign up with Google/)).toBeVisible();
    await page.getByRole("button", { name: "Cookie preferences" }).click();
    await expect(
      page.getByRole("button", { name: "Accept all" }),
    ).toBeVisible();
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Pricing" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
}

test("landing page retains the original product detail and branded home link", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "eStories home", exact: true }),
  ).toHaveAttribute("href", "/");
  for (const name of [
    "Just talk",
    "See your patterns",
    "Yours forever",
    "Curate your story",
    "Real stories, real people",
    "Your story has value",
    "Free",
    "Storyteller",
    "Creator",
    "Your story starts here",
  ]) {
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByText("Founder, eStories", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Is on-chain verification available?" }),
  ).toBeVisible();
});
