import { test, expect, type Page } from "@playwright/test";

// Layout fixtures intercept all network traffic. The isolated build uses the
// intentionally invalid synthetic host, which production CSP correctly blocks.
// Keep CSP enforcement in the separate public-journey suite.
test.use({ bypassCSP: true });

const id = "33333333-3333-4333-8333-333333333333";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Writer".repeat(12),
  username: "synthetic_writer",
  email: "writer@example.com",
  auth_provider: "google",
  is_onboarded: true,
  wallet_address: null,
  avatar: null,
  subscription_plan: "free",
  bio: "Perspective".repeat(40),
};
const story = {
  id,
  numeric_id: 1,
  title: "A long title " + "remember".repeat(35),
  content: "A moment " + "unbroken".repeat(80),
  created_at: "2026-11-27T10:00:00Z",
  story_date: "2026-11-27",
  is_public: true,
  author_id: "22222222-2222-4222-8222-222222222222",
  author: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Storyteller".repeat(15),
    username: "writer".repeat(12),
    followers_count: 2,
  },
  tags: ["memory".repeat(30)],
  likes: 6,
  shares: 1,
  has_audio: false,
  paywall_amount: 0,
};

async function fixture(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const writes: string[] = [];
  const pages: string[] = [];
  let failed = false;
  let liked = false;
  await page.context().route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (
      ["synthetic.invalid", "placeholder.supabase.co"].includes(url.hostname) &&
      url.pathname.startsWith("/rest/v1/")
    )
      return ["GET", "HEAD"].includes(req.method())
        ? route.fulfill({
            json: url.pathname.endsWith("/stories") ? [story] : [],
            headers: { "content-range": "0-0/0" },
          })
        : route.abort();
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/user/profile")
      return route.fulfill({ json: { user } });
    if (url.pathname === "/api/auth/refresh")
      return route.fulfill({
        json: { access_token: "synthetic-post-auth-token" },
      });
    if (url.pathname === "/api/stories/feed") {
      pages.push(url.search);
      if (failed)
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      return route.fulfill({
        json: {
          stories: url.searchParams.has("cursor")
            ? [{ ...story, title: "The next chapter" }]
            : [story],
          nextCursor: url.searchParams.has("cursor")
            ? null
            : "synthetic-next-page",
        },
      });
    }
    if (url.pathname === "/api/social/like" && req.method() === "POST") {
      writes.push(url.pathname);
      liked = !liked;
      return route.fulfill({
        json: {
          success: true,
          data: { isLiked: liked, totalLikes: liked ? 7 : 6 },
        },
      });
    }
    if (req.method() !== "GET") {
      writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname === "/api/social/like/status")
      return route.fulfill({ json: { liked: { [id]: liked } } });
    if (url.pathname === "/api/social/follow")
      return route.fulfill({ json: { following: {} } });
    if (url.pathname === "/api/stories")
      return route.fulfill({
        json: { stories: [{ ...story, author_id: user.id }] },
      });
    if (url.pathname === `/api/stories/${id}`)
      return route.fulfill({ json: { story, comments: [] } });
    return route.fulfill({
      json: {
        stories: [],
        collections: [],
        notifications: [],
        unreadCount: 0,
        habits: [],
        metadata: null,
      },
    });
  });
  return {
    writes,
    pages,
    fail: () => {
      failed = true;
    },
  };
}

test("Home replaces marketing after login, paginates, keeps actions separate from reading and preserves explicit pages", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!);
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your next chapter starts here.",
  );
  await expect(page.getByRole("link", { name: story.title })).toBeVisible();
  await page.getByRole("button", { name: "Like story", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlike story", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("button", { name: "Next stories" }).click();
  await expect(
    page.getByRole("link", { name: "The next chapter" }),
  ).toBeVisible();
  expect(
    state.pages.some((query) => query.includes("cursor=synthetic-next-page")),
  ).toBe(true);
  await page.getByRole("button", { name: "Previous stories" }).click();
  await expect(page.getByRole("link", { name: story.title })).toBeVisible();
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Speak your story",
  );
  await page.goto("/record");
  await expect(page).toHaveURL(/\/record$/);
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual(["/api/social/like"]);
});

test("feed failure is recoverable and distinct from an empty community", async ({
  page,
  baseURL,
}) => {
  const state = await fixture(page, baseURL!);
  state.fail();
  await page.goto("/home");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Stories are temporarily unavailable" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Retry feed" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No stories found" }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test(`workspace reflows at ${width}px with long content and usable controls`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page, baseURL!);
    for (const path of [
      "/home",
      "/record",
      "/library",
      "/profile",
      `/story/${id}`,
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      // Wait for the data boundary, not just the shell heading.
      if (path === "/home")
        await expect(
          page.getByRole("link", { name: story.title }),
        ).toBeVisible();
      if (path === "/record")
        await expect(
          page.getByRole("button", { name: "Start recording", exact: true }),
        ).toBeVisible();
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      expect(
        await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          content: document.documentElement.scrollWidth,
        })),
        path,
      ).toEqual({ viewport: width, content: width });
      if (path === "/library") {
        await page
          .getByRole("tab", { name: "Collections", exact: true })
          .click();
        await expect(
          page.getByRole("tab", { name: "Collections", exact: true }),
        ).toHaveAttribute("data-state", "active");
      }
      await page.evaluate(() =>
        document.documentElement.classList.remove("dark"),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path}, light`,
      ).toBe(width);
    }
  });
}

test("landing example supports keyboard exploration and reduced motion without provider calls", async ({
  page,
  baseURL,
}) => {
  // Anonymous fixture, same-origin assets only; no provider can receive this interaction.
  const origin = new URL(baseURL!).origin;
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    return route.continue();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const voice = page.getByRole("tab", { name: "Voice", exact: true });
  await voice.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Words", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "You remain the author",
  );
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Chapter", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".scene-book img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".scene-book img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: `output/playwright/review/${test.info().project.name}-chapter.png`,
  });
  await expect(
    page.getByText("Fictional story sample", { exact: true }),
  ).toBeVisible();
});
