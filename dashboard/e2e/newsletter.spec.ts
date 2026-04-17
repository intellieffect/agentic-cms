import { test, expect } from '@playwright/test';

test.describe('Newsletter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/newsletter');
  });

  test('page loads at /newsletter', async ({ page }) => {
    await expect(page).toHaveURL('/newsletter');
  });

  test('heading shows 뉴스레터', async ({ page }) => {
    await expect(page.locator('h1', { hasText: '뉴스레터' })).toBeVisible();
  });

  test('sidebar Newsletter nav item is visible', async ({ page }) => {
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=Newsletter').first()).toBeVisible();
  });
});
