import { test, expect } from '@playwright/test';

test.describe('Video', () => {
  test('/video/projects loads', async ({ page }) => {
    const response = await page.goto('/video/projects');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1', { hasText: '영상 프로젝트' })).toBeVisible();
  });

  test('/video/references loads', async ({ page }) => {
    const response = await page.goto('/video/references');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1', { hasText: '영상 레퍼런스' })).toBeVisible();
  });

  test('/video/finished loads', async ({ page }) => {
    const response = await page.goto('/video/finished');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1', { hasText: '완료 영상' })).toBeVisible();
  });

  test('sidebar shows Video group', async ({ page }) => {
    await page.goto('/video/projects');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text=프로젝트').first()).toBeVisible();
  });
});
