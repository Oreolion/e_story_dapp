import { test, expect } from "@playwright/test";

test.slow();

test.describe("Landing Page Fixes", () => {
  test("Main writing action opens the recording page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Preparing your experience")).not.toBeVisible({
      timeout: 30000,
    });

    // The restored hero retains its original writing action.
    const startBtn = page
      .getByRole("link", {
        name: "Start Writing — Free",
        exact: true,
      })
      .first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });

    // Click and verify navigation goes to /record (not /api/auth/callback)
    await startBtn.click();
    await page.waitForURL("**/record", { timeout: 30000 });
    expect(page.url()).toContain("/record");
  });

  test("Original hero tagline remains visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Preparing your experience")).not.toBeVisible({
      timeout: 30000,
    });

    const heading = page.getByRole("heading", {
      name: /Speak your story, see your patterns/i,
    });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Social Page", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
  });
  test("shows bounded feed navigation without fabricated community totals", async ({
    page,
  }) => {
    await page.route("**/api/stories/feed**", (route) =>
      route.fulfill({ json: { stories: [], nextCursor: null } }),
    );
    await page.goto("/social");
    await expect(
      page.getByRole("heading", { name: /Discover.*Stories/i }),
    ).toBeVisible({ timeout: 15000 });
    for (const name of ["Latest", "Trending", "Following"])
      await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Community statistics" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "No stories found" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next stories" }),
    ).toBeDisabled();
    await expect(page.getByText("2.8K", { exact: true })).toHaveCount(0);
  });
  test("renders the requested public story and a separate reader link", async ({
    page,
  }) => {
    const id = "33333333-3333-4333-8333-333333333333";
    await page.route("**/api/stories/feed**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("pagination")).toBe("cursor");
      expect(params.get("limit")).toBe("20");
      return route.fulfill({
        json: {
          stories: [
            {
              id,
              numeric_id: 1,
              title: "A synthetic Sunday",
              content: "A fictional memory for this browser test.",
              created_at: "2026-11-27T10:00:00Z",
              is_public: true,
              paywall_amount: 0,
              author: {
                id: "22222222-2222-4222-8222-222222222222",
                name: "Synthetic Writer",
                username: "synthetic_writer",
              },
            },
          ],
          nextCursor: null,
        },
      });
    });
    await page.goto("/social");
    await expect(
      page.getByRole("link", { name: "A synthetic Sunday" }),
    ).toHaveAttribute("href", `/story/${id}`, { timeout: 15000 });
    await expect(
      page.getByText("A fictional memory for this browser test.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Like story", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next stories" }),
    ).toBeDisabled();
  });
});

test.describe("Story Detail Page", () => {
  test("loads a story without infinite loading", async ({ page }) => {
    // First get a story ID from the feed
    const feedRes = await page.request.get("/api/stories/feed");
    expect(feedRes.ok()).toBeTruthy();
    const { stories } = await feedRes.json();

    if (stories.length === 0) {
      test.skip(true, "No public stories to test");
      return;
    }

    const storyId = stories[0].id;
    await page.goto(`/story/${storyId}`);
    await expect(page.getByText("Preparing your experience")).not.toBeVisible({
      timeout: 30000,
    });

    // Loading spinner should disappear within 15 seconds (our timeout)
    await expect(page.getByText("Loading story...")).not.toBeVisible({
      timeout: 20000,
    });

    // Story title should be visible (or "Story not found" for deleted stories)
    const titleVisible = await page
      .getByRole("heading")
      .first()
      .isVisible()
      .catch(() => false);
    const notFound = await page
      .getByText("Story not found")
      .isVisible()
      .catch(() => false);
    expect(titleVisible || notFound).toBeTruthy();
  });
});

test.describe("API Endpoints - Tables Exist", () => {
  test("POST /api/social/like returns 401 without auth (not 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/social/like", {
      data: { storyId: "00000000-0000-0000-0000-000000000000" },
    });
    // 401 = auth required (correct). 500 = table missing (bug).
    expect(res.status()).toBe(401);
  });

  test("POST /api/social/follow returns 401 without auth (not 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/social/follow", {
      data: { followed_id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/social/like/status returns 401 without auth (not 500)", async ({
    request,
  }) => {
    const res = await request.get("/api/social/like/status?story_ids=test");
    expect(res.status()).toBe(401);
  });

  test("GET /api/social/follow returns 401 without auth (not 500)", async ({
    request,
  }) => {
    const res = await request.get("/api/social/follow?followed_ids=test");
    expect(res.status()).toBe(401);
  });

  test("GET /api/stories/feed returns 200 with stories array", async ({
    request,
  }) => {
    const res = await request.get("/api/stories/feed");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("stories");
    expect(Array.isArray(body.stories)).toBeTruthy();
  });
});
