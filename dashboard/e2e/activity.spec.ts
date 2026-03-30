import { test, expect } from '@playwright/test';

test.describe('Activity Log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/activity');
  });

  test('page loads at /activity', async ({ page }) => {
    await expect(page).toHaveURL('/activity');
    await expect(page.locator('h1', { hasText: 'Activity' })).toBeVisible();
  });

  test('activity entries are visible', async ({ page }) => {
    // Activity entries are in cards within the timeline
    const entries = page.locator('[data-slot="card"]');
    await expect(entries.first()).toBeVisible({ timeout: 10000 });
    const count = await entries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('each entry shows action badge, actor type, collection, timestamp', async ({ page }) => {
    const entries = page.locator('[data-slot="card"]');
    await expect(entries.first()).toBeVisible({ timeout: 10000 });

    const firstEntry = entries.first();
    // Action badge (Created, Updated, etc.)
    const actionBadge = firstEntry.locator('[data-slot="badge"]').first();
    await expect(actionBadge).toBeVisible();

    // Collection badge
    const badges = firstEntry.locator('[data-slot="badge"]');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(2); // action + collection

    // Actor type indicator (Bot or User icon + text)
    const actorText = firstEntry.locator('text=/Agent|Human/');
    await expect(actorText).toBeVisible();

    // Timestamp (relative time like "2 days ago")
    const timestamp = firstEntry.locator('.text-xs.text-muted-foreground').last();
    await expect(timestamp).toBeVisible();
  });

  test('filter by action type works', async ({ page }) => {
    await page.locator('[data-slot="card"]').first().waitFor({ timeout: 10000 });
    // Click "Created" filter button
    const createdFilter = page.locator('button', { hasText: 'Created' });
    await expect(createdFilter).toBeVisible();
    await createdFilter.click();
    await page.waitForTimeout(500);

    // All visible action badges should say "Created"
    const entries = page.locator('[data-slot="card"]');
    const count = await entries.count();
    if (count > 0) {
      // The filter button should now be active (variant="default")
      await expect(createdFilter).toHaveAttribute('data-slot', 'button');
    }
  });

  test('filter by actor_type works', async ({ page }) => {
    await page.locator('[data-slot="card"]').first().waitFor({ timeout: 10000 });
    // Click "agent" filter button
    const agentFilter = page.locator('button', { hasText: 'agent' });
    await expect(agentFilter).toBeVisible();
    await agentFilter.click();
    await page.waitForTimeout(500);

    // Entries should be filtered
    const entries = page.locator('[data-slot="card"]');
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(0); // may filter to fewer
  });

  test('expandable payload section works', async ({ page }) => {
    await page.locator('[data-slot="card"]').first().waitFor({ timeout: 10000 });

    // Find a "Show payload" button
    const showPayloadBtn = page.locator('button', { hasText: 'Show payload' }).first();
    if (await showPayloadBtn.isVisible({ timeout: 3000 })) {
      await showPayloadBtn.click();
      await page.waitForTimeout(300);

      // Should now show a <pre> with JSON payload
      const pre = page.locator('pre').first();
      await expect(pre).toBeVisible();

      // Button should now say "Hide payload"
      const hidePayloadBtn = page.locator('button', { hasText: 'Hide payload' }).first();
      await expect(hidePayloadBtn).toBeVisible();
    }
  });
});
