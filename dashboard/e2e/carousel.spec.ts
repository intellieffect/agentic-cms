import { test, expect } from '@playwright/test';

test.describe('Carousel', () => {
  test('/carousel loads without error', async ({ page }) => {
    const response = await page.goto('/carousel');
    expect(response?.status()).toBe(200);
  });

  test('/carousel/references loads', async ({ page }) => {
    const response = await page.goto('/carousel/references');
    expect(response?.status()).toBe(200);
  });

  test('/carousel/templates loads', async ({ page }) => {
    const response = await page.goto('/carousel/templates');
    expect(response?.status()).toBe(200);
  });

  test('sidebar shows Carousel group', async ({ page }) => {
    await page.goto('/carousel');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=캐러셀').first()).toBeVisible();
  });
});
