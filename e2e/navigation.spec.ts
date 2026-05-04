import { test, expect } from '@playwright/test';

// 1. Increase global timeout for this file to handle slow local compilation
test.slow();

test('Landing page loads and navigation works', async ({ page }) => {
  await page.goto('/');

  // 2. Wait for hydration
  await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

  // 3. Check Title
  await expect(page).toHaveTitle(/EStories/i);

  // 4. Verify Hero Text
  await expect(page.getByRole('heading', { name: /Speak your story/i })).toBeVisible({ timeout: 10000 });

  // 5. Check "See How It Works" button
  const howItWorksBtn = page.getByRole('button', { name: /See How It Works/i });
  await expect(howItWorksBtn).toBeVisible();
});

test('Record page protects route when disconnected', async ({ page }) => {
  await page.goto('/record');

  // 1. Wait for hydration loader to finish
  await expect(page.getByText('Loading Wallet Connectors...')).not.toBeVisible({ timeout: 30000 });

  // 2. Verify the sign-in gate is shown when wallet is not connected
  await expect(page.getByRole('heading', { name: /Sign In to Record/i })).toBeVisible({ timeout: 15000 });
});
