import { test, expect } from '@playwright/test';

test.describe('Task Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
  });

  test('task board page loads with sidebar and grid', async ({ page }) => {
    await expect(page.locator('.task-board')).toBeVisible();
    await expect(page.locator('.task-board__sidebar')).toBeVisible();
    await expect(page.locator('.task-board__grid')).toBeVisible();
  });

  test('create button is visible', async ({ page }) => {
    await expect(page.getByText('+ Create')).toBeVisible();
  });

  test('scope dropdown is visible with options', async ({ page }) => {
    const select = page.locator('.task-board__toolbar select');
    await expect(select).toBeVisible();
  });

  test('done toggle is visible', async ({ page }) => {
    const toggle = page.locator('.task-board__done-toggle');
    await expect(toggle).toBeVisible();
  });

  test('calendar is visible with month navigation', async ({ page }) => {
    await expect(page.locator('.jads-calendar')).toBeVisible();
    await expect(page.getByLabel('Previous month')).toBeVisible();
    await expect(page.getByLabel('Next month')).toBeVisible();
  });

  test('create form opens as overlay and closes', async ({ page }) => {
    await page.getByText('+ Create').click();
    await expect(page.locator('.task-board__form-overlay')).toBeVisible();
    await expect(page.locator('.task-board__form')).toBeVisible();

    // Has title, jira, type, and dates fields
    await expect(page.getByText('Title')).toBeVisible();
    await expect(page.getByText('JIRA Ticket')).toBeVisible();
    await expect(page.getByText('Dates')).toBeVisible();

    // Cancel closes the form
    await page.getByText('Cancel').click();
    await expect(page.locator('.task-board__form-overlay')).not.toBeVisible();
  });

  test('create form has today button for dates', async ({ page }) => {
    await page.getByText('+ Create').click();
    await expect(page.getByText('+ Today')).toBeVisible();
  });

  test('clicking overlay backdrop closes form', async ({ page }) => {
    await page.getByText('+ Create').click();
    await expect(page.locator('.task-board__form-overlay')).toBeVisible();

    // Click the overlay backdrop (outside the form)
    await page.locator('.task-board__form-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.task-board__form-overlay')).not.toBeVisible();
  });

  test('done toggle switches between dim and hide', async ({ page }) => {
    const toggle = page.locator('.task-board__done-toggle');
    await expect(toggle).toBeVisible();

    // Click to toggle
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Click again to toggle back
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
