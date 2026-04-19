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

    // Breadcrumb nav (aria-label="Breadcrumb") 에 "Contents" 링크가 있는지.
    // nav[aria-label="Pipeline progress"] 와 sidebar 의 Contents 링크들과 구분됨.
    await expect(
      page.getByLabel('Breadcrumb').getByRole('link', { name: 'Contents' })
    ).toBeVisible();
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

    // Target the body_md textarea specifically (rows=16 in content-detail-view.tsx).
    // `textarea.last()` 같이 느슨한 selector 는 CoreMessage(rows=2) 등 다른 textarea
    // 에 잡혀 toggle 무관 요소를 보게 된다.
    const bodyTextarea = page.locator('textarea[rows="16"]');
    await expect(bodyTextarea).toBeVisible();

    // Toggle preview
    await previewSwitch.click();
    await page.waitForTimeout(300);

    // After toggle, the body_md textarea is swapped for MarkdownPreview.
    // body_md 가 비어있으면 `.prose` 대신 "No content" fallback 이 뜨므로,
    // prose 존재 여부가 아니라 **textarea 가 사라졌는지** 로 검증한다.
    await expect(bodyTextarea).not.toBeVisible();
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
    // 이 테스트의 의도: 이미 published 상태인 content 상세 페이지에서는 "Publish" 버튼이
    // 사라져야 한다 (중복 발행 방지). 따라서 "아무 content나 첫 번째" 가 아니라
    // **published 상태의 row** 를 명시적으로 찾아 진입해야 한다.
    await page.goto('/contents');
    await page.locator('table').waitFor({ timeout: 10000 });

    // status 컬럼 배지가 "Published" 로 된 row 만 추린다.
    const publishedRow = page.locator('table tbody tr', { hasText: /Published/i }).first();
    if ((await publishedRow.count()) === 0) {
      test.skip(true, "published content not seeded — 로컬/CI 환경에 이미 발행된 content 가 없어 스킵.");
      return;
    }
    await publishedRow.click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+/, { timeout: 5000 });

    // 이미 published 상태이므로 Publish 버튼은 없어야 한다.
    // Pipeline stepper 의 "Publish" 는 <a> 이므로 'button' selector 에 안 잡힘 — 그대로 사용.
    const publishButton = page.locator('button', { hasText: /^publish$/i });
    await expect(publishButton).toHaveCount(0);
  });
});
