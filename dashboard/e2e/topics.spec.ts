import { test, expect } from '@playwright/test';

test.describe('Topics', () => {
  test('topics page loads', async ({ page }) => {
    await page.goto('/topics');
    await expect(page.locator('h1', { hasText: 'Topics' })).toBeVisible();
  });

  test('topic cards are displayed', async ({ page }) => {
    await page.goto('/topics');
    // Wait for cards to load (not skeleton)
    const cardsWithBadges = page.locator('[data-slot="card"]').filter({
      has: page.locator('[data-slot="badge"]'),
    });
    await expect(cardsWithBadges.first()).toBeVisible({ timeout: 10000 });
    const count = await cardsWithBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sidebar has Topics link', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.locator('text=Topics').first()).toBeVisible();
  });

  test('sidebar has Variants link', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar.locator('text=Variants').first()).toBeVisible();
  });
});
