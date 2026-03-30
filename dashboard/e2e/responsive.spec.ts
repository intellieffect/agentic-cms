import { test, expect } from '@playwright/test';

test.describe('Responsive', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('dashboard renders on mobile viewport', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
  });

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    // On mobile, sidebar should be hidden/collapsed
    const isVisible = await sidebar.isVisible().catch(() => false);
    if (isVisible) {
      // If visible in DOM, check it's off-screen or has collapsed state
      const box = await sidebar.boundingBox();
      // Sidebar should be off-screen (x < 0 or width = 0) or not visible
      expect(box === null || (box && box.x + box.width <= 0)).toBeTruthy();
    }
  });

  test('sidebar trigger button is visible on mobile', async ({ page }) => {
    await page.goto('/');
    // SidebarTrigger renders a button
    const trigger = page.locator('button[data-sidebar="trigger"]');
    await expect(trigger).toBeVisible();
  });

  test('clicking sidebar trigger shows sidebar on mobile', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('button[data-sidebar="trigger"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);

    // After clicking, sidebar should become visible (as sheet/overlay on mobile)
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 3000 });
  });
});
