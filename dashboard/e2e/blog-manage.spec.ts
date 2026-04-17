import { test, expect } from '@playwright/test';

test.describe('Blog Manage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog-manage');
  });

  test('page loads at /blog-manage', async ({ page }) => {
    await expect(page).toHaveURL('/blog-manage');
  });

  test('heading shows 블로그 관리', async ({ page }) => {
    await expect(page.locator('h1', { hasText: '블로그 관리' })).toBeVisible();
  });

  test('sidebar Blog nav item is visible', async ({ page }) => {
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=Blog').first()).toBeVisible();
  });
});
