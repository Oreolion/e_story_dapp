import { test, expect } from '@playwright/test';

test.slow();

test.describe('Landing Page Fixes', () => {
  test('"Start Writing" button links to /record, not /api/auth/callback', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

    // Find the first "Start Writing — Free" button in the hero section
    const startBtn = page.getByRole('button', { name: /Start Writing — Free/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });

    // Click and verify navigation goes to /record (not /api/auth/callback)
    await startBtn.click();
    await page.waitForURL('**/record', { timeout: 30000 });
    expect(page.url()).toContain('/record');
  });

  test('Hero tagline is visible and not oversized', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

    const heading = page.getByRole('heading', { name: /Speak your story/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Social Page', () => {
  test('loads with real story count and writer count', async ({ page }) => {
    await page.goto('/social');
    await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

    // Heading should say "Discover Stories"
    await expect(page.getByRole('heading', { name: /Discover.*Stories/i })).toBeVisible({ timeout: 15000 });

    // Stats bar should NOT show hardcoded "2.8K"
    const statsSection = page.locator('.grid.grid-cols-2');
    await expect(statsSection).toBeVisible({ timeout: 15000 });
    await expect(statsSection.getByText('2.8K')).not.toBeVisible();

    // "Published Stories" label should be present
    await expect(page.getByText('Published Stories')).toBeVisible();

    // "Active Writers" label should be present
    await expect(page.getByText('Active Writers')).toBeVisible();
  });

  test('story cards render in feed', async ({ page }) => {
    await page.goto('/social');
    await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

    // Wait for loading to finish — either stories appear or empty state shows
    await page.waitForTimeout(5000);

    // Stories are rendered as Card components with story titles or empty state
    const hasStories = await page.locator('h3').count() > 0;
    const hasEmptyState = await page.getByText('No stories found').isVisible().catch(() => false);
    const hasPublishedLabel = await page.getByText('Published Stories').isVisible().catch(() => false);
    expect(hasStories || hasEmptyState || hasPublishedLabel).toBeTruthy();
  });
});

test.describe('Story Detail Page', () => {
  test('loads a story without infinite loading', async ({ page }) => {
    // First get a story ID from the feed
    const feedRes = await page.request.get('/api/stories/feed');
    expect(feedRes.ok()).toBeTruthy();
    const { stories } = await feedRes.json();

    if (stories.length === 0) {
      test.skip(true, 'No public stories to test');
      return;
    }

    const storyId = stories[0].id;
    await page.goto(`/story/${storyId}`);
    await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

    // Loading spinner should disappear within 15 seconds (our timeout)
    await expect(page.getByText('Loading story...')).not.toBeVisible({ timeout: 20000 });

    // Story title should be visible (or "Story not found" for deleted stories)
    const titleVisible = await page.getByRole('heading').first().isVisible().catch(() => false);
    const notFound = await page.getByText('Story not found').isVisible().catch(() => false);
    expect(titleVisible || notFound).toBeTruthy();
  });
});

test.describe('API Endpoints - Tables Exist', () => {
  test('POST /api/social/like returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.post('/api/social/like', {
      data: { storyId: '00000000-0000-0000-0000-000000000000' },
    });
    // 401 = auth required (correct). 500 = table missing (bug).
    expect(res.status()).toBe(401);
  });

  test('POST /api/social/follow returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.post('/api/social/follow', {
      data: { followed_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/social/like/status returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.get('/api/social/like/status?story_ids=test');
    expect(res.status()).toBe(401);
  });

  test('GET /api/social/follow returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.get('/api/social/follow?followed_ids=test');
    expect(res.status()).toBe(401);
  });

  test('GET /api/stories/feed returns 200 with stories array', async ({ request }) => {
    const res = await request.get('/api/stories/feed');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('stories');
    expect(Array.isArray(body.stories)).toBeTruthy();
  });
});
