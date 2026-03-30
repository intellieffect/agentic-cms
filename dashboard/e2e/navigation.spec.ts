import { test, expect } from '@playwright/test';

test.describe('Navigation & Command Palette', () => {
  test('all sidebar links navigate to correct pages', async ({ page }) => {
    await page.goto('/');

    const navLinks = [
      { text: 'Contents', url: '/contents' },
      { text: 'Ideas', url: '/ideas' },
      { text: 'Publications', url: '/publications' },
      { text: 'Activity', url: '/activity' },
      { text: 'Media', url: '/media' },
      { text: 'Dashboard', url: '/' },
    ];

    for (const { text, url } of navLinks) {
      const link = page.locator('[data-sidebar="sidebar"]').locator(`a`, { hasText: text }).first();
      await link.click();
      await page.waitForURL(url, { timeout: 5000 });
      expect(page.url()).toContain(url === '/' ? '' : url);
    }
  });

  test('command palette opens with Cmd+K', async ({ page }) => {
    await page.goto('/');
    // Press Cmd+K (or Ctrl+K on non-Mac)
    await page.keyboard.press('Meta+k');
    // Command dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    // Should have search input
    const input = dialog.locator('input[placeholder*="command"]');
    await expect(input).toBeVisible();
  });

  test('command palette shows page options', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Check for page options
    const pageNames = ['Dashboard', 'Contents', 'Ideas', 'Publications', 'Activity Log', 'Media Library'];
    for (const name of pageNames) {
      await expect(dialog.locator(`text=${name}`).first()).toBeVisible();
    }
  });

  test('selecting a page in command palette navigates correctly', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Click on "Ideas" option
    const ideasOption = dialog.locator('[cmdk-item]', { hasText: 'Ideas' });
    await ideasOption.click();
    await page.waitForURL('/ideas', { timeout: 5000 });
    expect(page.url()).toContain('/ideas');
  });

  test('browser back/forward works', async ({ page }) => {
    await page.goto('/');
    await page.goto('/contents');
    await page.goto('/ideas');

    // Go back
    await page.goBack();
    await page.waitForURL('/contents', { timeout: 5000 });
    expect(page.url()).toContain('/contents');

    // Go forward
    await page.goForward();
    await page.waitForURL('/ideas', { timeout: 5000 });
    expect(page.url()).toContain('/ideas');
  });
});
