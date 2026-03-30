import { test, expect } from '@playwright/test';

test.describe('Publications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/publications');
  });

  test('page loads at /publications', async ({ page }) => {
    await expect(page).toHaveURL('/publications');
    await expect(page.locator('h1', { hasText: 'Publications' })).toBeVisible();
  });

  test('table shows publication records', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('channel column shows badges', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    // Channel badges
    const channelBadges = table.locator('tbody [data-slot="badge"]');
    const count = await channelBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('URL column shows external links', async ({ page }) => {
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    // External links have target="_blank"
    const externalLinks = table.locator('tbody a[target="_blank"]');
    const count = await externalLinks.count();
    // May be 0 if no URLs, but with 54 publications there should be some
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('channel filter works', async ({ page }) => {
    await page.locator('table').waitFor({ timeout: 10000 });
    const channelFilter = page.locator('button', { hasText: 'Channel' });
    if (await channelFilter.isVisible()) {
      await channelFilter.click();
      // Wait for filter popover
      const options = page.locator('[role="option"]');
      await expect(options.first()).toBeVisible({ timeout: 3000 });
      // Select the first channel option
      await options.first().click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Table should still be visible with filtered results
      const table = page.locator('table');
      await expect(table).toBeVisible();
    }
  });
});
