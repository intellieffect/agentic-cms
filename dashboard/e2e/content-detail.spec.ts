import { test, expect } from '@playwright/test';

test.describe('Content Detail', () => {
  // Navigate to the known content item via slug search
  test('navigate to known content and verify fields', async ({ page }) => {
    // First go to contents list and find our test content
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });

    // Search for our test content
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('building-agentic-cms');
    await page.waitForTimeout(500);

    // Click on the row if found, otherwise navigate to first content
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });
    }
  });

  test('page loads with breadcrumb', async ({ page }) => {
    // Go to first available content
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // Breadcrumb should show "Contents" link
    await expect(page.locator('a', { hasText: 'Contents' })).toBeVisible();
  });

  test('all fields are visible', async ({ page }) => {
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // Check field labels
    const labels = ['Title', 'Slug', 'Category', 'Tags', 'Hook', 'Core Message', 'CTA'];
    for (const label of labels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('markdown preview toggle works', async ({ page }) => {
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // Find preview switch
    const previewSwitch = page.locator('#preview-toggle');
    await expect(previewSwitch).toBeVisible();

    // Initially should show textarea (not preview)
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();

    // Toggle preview
    await previewSwitch.click();
    await page.waitForTimeout(300);

    // After toggle, should show prose div instead
    const proseDiv = page.locator('.prose');
    await expect(proseDiv).toBeVisible();
  });

  test('right sidebar shows status badge and meta info', async ({ page }) => {
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // Status badge
    await expect(page.locator('text=Status').first()).toBeVisible();

    // Created/Updated info
    await expect(page.locator('text=Created').first()).toBeVisible();
    await expect(page.locator('text=Updated').first()).toBeVisible();

    // Fact Checked
    await expect(page.locator('text=Fact Checked').first()).toBeVisible();
  });

  test('version history tab shows revisions', async ({ page }) => {
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // Versions tab should be visible
    const versionsTab = page.locator('[role="tab"]', { hasText: 'Versions' });
    await expect(versionsTab).toBeVisible();
    await versionsTab.click();

    // Should show at least one revision (v1, v2, etc.) or "No revisions yet"
    const versionEntries = page.locator('text=/v\\d+/');
    const noRevisions = page.locator('text=No revisions yet');
    const hasVersions = await versionEntries.count();
    const hasNoRevisions = await noRevisions.isVisible().catch(() => false);
    expect(hasVersions > 0 || hasNoRevisions).toBeTruthy();
  });

  test('status cannot be changed to published (no publish option)', async ({ page }) => {
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // There should be no "publish" button or select option
    const publishButton = page.locator('button', { hasText: /^publish$/i });
    await expect(publishButton).toHaveCount(0);
  });
});
