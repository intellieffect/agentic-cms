import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('stat cards are horizontally aligned and equal width', async ({ page }) => {
    // Wait for real data (not skeleton)
    await page.waitForSelector('.text-3xl.font-bold', { timeout: 10000 });

    const cards = page.locator('[data-testid="stat-card"]').or(
      page.locator('.grid.gap-4 > div').first().locator('..').locator('> div')
    );

    // Use the stat card grid directly
    const statGrid = page.locator('.grid.gap-4.sm\\:grid-cols-2.lg\\:grid-cols-4');
    await expect(statGrid).toBeVisible();

    const gridChildren = statGrid.locator('> div');
    const count = await gridChildren.count();
    expect(count).toBe(4);

    // All cards should have same top position (aligned)
    const boxes = [];
    for (let i = 0; i < count; i++) {
      const box = await gridChildren.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
    }

    // On desktop (1280px), all 4 should be in one row
    const firstTop = boxes[0].y;
    for (const box of boxes) {
      expect(Math.abs(box.y - firstTop)).toBeLessThan(2);
    }

    // All cards should have equal width (within 2px tolerance)
    const firstWidth = boxes[0].width;
    for (const box of boxes) {
      expect(Math.abs(box.width - firstWidth)).toBeLessThan(2);
    }
  });

  test('activity and chart sections are side by side on desktop', async ({ page }) => {
    await page.waitForSelector('text=Agent Activity', { timeout: 10000 });
    await page.waitForSelector('text=Publications by Channel', { timeout: 10000 });

    const activityCard = page.locator('text=Agent Activity').locator('..').locator('..');
    const chartCard = page.locator('text=Publications by Channel').locator('..').locator('..');

    const activityBox = await activityCard.boundingBox();
    const chartBox = await chartCard.boundingBox();

    expect(activityBox).not.toBeNull();
    expect(chartBox).not.toBeNull();

    // They should be on the same row (similar Y position)
    expect(Math.abs(activityBox!.y - chartBox!.y)).toBeLessThan(5);

    // Activity should be wider than chart (3:2 ratio in 5-col grid)
    expect(activityBox!.width).toBeGreaterThan(chartBox!.width);
  });

  test('main content does not overflow viewport width', async ({ page }) => {
    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));

    // No horizontal scroll
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
  });

  test('sidebar is visible with reasonable width', async ({ page }) => {
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(sidebar).toBeVisible();

    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();

    // Sidebar should be between 120px (collapsed-ish) and 300px (expanded)
    expect(box!.width).toBeGreaterThan(120);
    expect(box!.width).toBeLessThan(300);
  });

  test('content is not visually hidden behind sidebar', async ({ page }) => {
    await page.waitForSelector('.text-3xl.font-bold', { timeout: 10000 });

    // Sidebar uses position:fixed + spacer div pattern
    // Verify title is visible and not clipped by checking it's fully within viewport
    const title = page.locator('h1', { hasText: 'Dashboard' });
    await expect(title).toBeVisible();
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();

    // Title should be visible (x > 0 means it has some offset from edge)
    expect(titleBox!.x).toBeGreaterThan(0);

    // Verify no horizontal scrollbar (content fits within viewport)
    const hasHScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHScroll).toBe(false);

    // Take a screenshot for visual regression baseline
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});

test.describe('Dashboard Layout - Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('stat cards stack on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.text-3xl.font-bold', { timeout: 10000 });

    const statGrid = page.locator('.grid.gap-4');
    const gridChildren = statGrid.first().locator('> div');
    const count = await gridChildren.count();

    if (count >= 2) {
      const box0 = await gridChildren.nth(0).boundingBox();
      const box1 = await gridChildren.nth(1).boundingBox();

      expect(box0).not.toBeNull();
      expect(box1).not.toBeNull();

      // On 375px, cards should stack (box1 below box0)
      expect(box1!.y).toBeGreaterThan(box0!.y + box0!.height - 5);
    }
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    }));

    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
  });
});
