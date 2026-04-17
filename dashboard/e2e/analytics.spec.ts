import { test, expect } from '@playwright/test';

test.describe('Analytics', () => {
  test('/analytics redirects to /analytics/traffic', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL('/analytics/traffic');
  });

  test('/analytics/traffic loads without error', async ({ page }) => {
    const response = await page.goto('/analytics/traffic');
    expect(response?.status()).toBe(200);
  });

  test('traffic page shows heading', async ({ page }) => {
    await page.goto('/analytics/traffic');
    await expect(page.locator('h1', { hasText: '트래픽' })).toBeVisible();
  });

  test('sidebar highlights Analytics section', async ({ page }) => {
    await page.goto('/analytics/traffic');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=Traffic').first()).toBeVisible();
  });
});
