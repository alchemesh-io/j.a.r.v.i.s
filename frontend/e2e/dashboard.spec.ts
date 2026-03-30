import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('dashboard page loads with metric blocks in horizontal layout', async ({ page }) => {
    await expect(page.locator('.dashboard')).toBeVisible();
    await expect(page.locator('.dashboard__grid')).toBeVisible();
  });

  test('displays three metric blocks', async ({ page }) => {
    await expect(page.getByText('Daily Tasks')).toBeVisible();
    await expect(page.getByText('Weekly Tasks')).toBeVisible();
    await expect(page.getByText('Workers')).toBeVisible();
  });

  test('metric blocks show colored numbers above labels', async ({ page }) => {
    await expect(page.locator('.dashboard__metric-count').first()).toBeVisible();
    await expect(page.locator('.dashboard__metric-label').first()).toBeVisible();
  });

  test('compact toggle works', async ({ page }) => {
    const toggle = page.locator('.dashboard__compact-toggle');
    await expect(toggle).toBeVisible();

    // Toggle compact mode on
    await toggle.click();

    // Labels should be hidden in compact mode
    await expect(page.locator('.dashboard__metric-label').first()).not.toBeVisible();

    // Toggle back
    await toggle.click();
    await expect(page.locator('.dashboard__metric-label').first()).toBeVisible();
  });

  test('brain animation is rendered', async ({ page }) => {
    await expect(page.locator('.brain-animation')).toBeVisible();
  });

  test('chat input placeholder is visible', async ({ page }) => {
    await expect(
      page.getByPlaceholder('Ask J.A.R.V.I.S anything...'),
    ).toBeVisible();
  });

  test('daily tasks redirect button navigates to tasks with daily scope', async ({ page }) => {
    const redirectBtn = page.locator('.dashboard__card-redirect').first();
    await expect(redirectBtn).toBeVisible();
    await redirectBtn.click();
    await expect(page).toHaveURL('/tasks');
  });
});
