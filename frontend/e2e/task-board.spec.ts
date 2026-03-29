import { test, expect } from '@playwright/test';

test.describe('Task Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
  });

  test('task board page loads', async ({ page }) => {
    await expect(page.locator('.task-board')).toBeVisible();
  });

  test('scope dropdown is visible', async ({ page }) => {
    await expect(page.getByText('Scope')).toBeVisible();
  });

  test('new task button is visible', async ({ page }) => {
    await expect(page.getByText('+ New Task')).toBeVisible();
  });

  test('create task form opens and closes', async ({ page }) => {
    await page.getByText('+ New Task').click();
    await expect(page.getByText('Title')).toBeVisible();
    await page.getByText('Cancel').click();
  });
});
