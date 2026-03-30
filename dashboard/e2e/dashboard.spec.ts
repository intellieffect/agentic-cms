import { test, expect } from '@playwright/test';

test.describe('Dashboard Home', () => {
  test('page loads without error', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('title shows Agentic CMS', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Agentic CMS')).toBeVisible();
  });

  test('sidebar is visible with all navigation links', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();

    const navLinks = ['Dashboard', 'Contents', 'Ideas', 'Publications', 'Activity', 'Media'];
    for (const link of navLinks) {
      await expect(sidebar.locator(`text=${link}`).first()).toBeVisible();
    }
  });

  test('4 stat cards are visible', async ({ page }) => {
    await page.goto('/');
    const cardTitles = ['Ideas', 'Drafts', 'In Review', 'Published'];
    for (const title of cardTitles) {
      await expect(page.locator(`text=${title}`).first()).toBeVisible();
    }
  });

  test('stat cards show non-zero numbers (real data exists)', async ({ page }) => {
    await page.goto('/');
    // Wait for stats to load (not skeleton)
    await page.waitForSelector('.text-3xl.font-bold', { timeout: 10000 });
    const statValues = await page.locator('.text-3xl.font-bold').allTextContents();
    // At least one stat should be non-zero
    const hasNonZero = statValues.some((v) => parseInt(v, 10) > 0);
    expect(hasNonZero).toBe(true);
  });

  test('activity feed section loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Agent Activity')).toBeVisible({ timeout: 10000 });
  });

  test('publications chart section loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Publications by Channel')).toBeVisible({ timeout: 10000 });
  });

  test('mobile: sidebar collapses on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    // On mobile, sidebar should not be visible by default (collapsed)
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    // The sidebar may be hidden or off-screen
    await expect(sidebar).toBeHidden({ timeout: 5000 }).catch(async () => {
      // Some implementations keep it in DOM but off-screen
      const box = await sidebar.boundingBox();
      expect(box === null || (box && box.x < 0)).toBeTruthy();
    });
  });
});
