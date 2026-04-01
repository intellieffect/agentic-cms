import { test, expect } from '@playwright/test';

test.describe('Variants', () => {
  test('variants page loads', async ({ page }) => {
    await page.goto('/variants');
    await expect(page.locator('h1', { hasText: 'Variants' })).toBeVisible();
  });
});
