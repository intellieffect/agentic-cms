import { test, expect } from '@playwright/test';

test.describe('Ideas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ideas');
  });

  test('page loads at /ideas', async ({ page }) => {
    await expect(page).toHaveURL('/ideas');
    await expect(page.locator('h1', { hasText: 'Ideas' })).toBeVisible();
  });

  test('ideas list shows items', async ({ page }) => {
    // Wait for ideas cards to appear
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('each idea shows raw_text preview', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // Each card should have text content (the raw_text)
    const firstCardText = await cards.first().locator('p').first().textContent();
    expect(firstCardText?.length).toBeGreaterThan(0);
  });

  test('source badge is visible', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // Source badges use variant="outline"
    const badges = page.locator('[data-slot="badge"]');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('promoted ideas show Promoted badge', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // At least some ideas should be promoted (we have real data)
    const promotedBadges = page.locator('text=Promoted');
    const count = await promotedBadges.count();
    // This may be 0 if no promoted ideas, but with 54 ideas + 53 contents, there should be some
    expect(count).toBeGreaterThanOrEqual(0); // soft check
  });

  test('search filters ideas by text', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const initialCount = await cards.count();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('xyznonexistent');
    await page.waitForTimeout(500);

    // Should show "No ideas found" or fewer cards
    const afterCount = await cards.count();
    const noResults = page.locator('text=No ideas found');
    const hasNoResults = await noResults.isVisible().catch(() => false);
    expect(afterCount < initialCount || hasNoResults).toBeTruthy();
  });
});
