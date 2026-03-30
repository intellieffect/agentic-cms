import { test, expect } from '@playwright/test';

test.describe('Media', () => {
  test('page loads at /media', async ({ page }) => {
    const response = await page.goto('/media');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL('/media');
  });

  test('page renders without error with placeholder state', async ({ page }) => {
    await page.goto('/media');
    await expect(page.locator('h1', { hasText: 'Media Library' })).toBeVisible();
    // Should show empty state placeholder
    await expect(page.locator('text=No media yet')).toBeVisible();
  });

  test('upload button is visible but disabled', async ({ page }) => {
    await page.goto('/media');
    const uploadBtn = page.locator('button', { hasText: 'Upload' });
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toBeDisabled();
  });
});
