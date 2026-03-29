import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('dashboard page loads with metric blocks', async ({ page }) => {
    await expect(page.locator('.dashboard')).toBeVisible();
  });

  test('compact mode toggle works', async ({ page }) => {
    const compactBtn = page.getByText('Compact');
    await expect(compactBtn).toBeVisible();
    await compactBtn.click();
    await expect(page.getByText('Expand')).toBeVisible();
  });

  test('brain animation is rendered', async ({ page }) => {
    await expect(page.locator('.brain-animation')).toBeVisible();
  });

  test('chat input placeholder is visible', async ({ page }) => {
    await expect(
      page.getByPlaceholder('Ask J.A.R.V.I.S anything...'),
    ).toBeVisible();
  });
});
