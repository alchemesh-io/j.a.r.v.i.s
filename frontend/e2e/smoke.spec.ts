import { test, expect } from '@playwright/test';

test('app loads with header visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.getByLabel('J.A.R.V.I.S')).toBeVisible();
});

test('navigation between dashboard and tasks', async ({ page }) => {
  await page.goto('/');

  // Navigate to tasks
  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(page).toHaveURL('/tasks');

  // Navigate back to dashboard
  await page.getByLabel('J.A.R.V.I.S').click();
  await expect(page).toHaveURL('/');
});

test('footer is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('footer')).toContainText('Alchemesh IO');
});
