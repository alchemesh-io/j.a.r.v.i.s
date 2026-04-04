import { test, expect } from '@playwright/test';

test.describe('Task Import — JIRA', () => {
  test.beforeEach(async ({ page }) => {
    // Mock JIRA config as configured
    await page.route('**/api/v1/jira/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, projectUrl: 'https://test.atlassian.net' }),
      }),
    );
    // Mock JIRA tickets
    await page.route('**/api/v1/jira/tickets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { key: 'JAR-1', summary: 'Fix login bug', status: 'To Do', url: 'https://test.atlassian.net/browse/JAR-1' },
          { key: 'JAR-2', summary: 'Add feature X', status: 'In Progress', url: 'https://test.atlassian.net/browse/JAR-2' },
        ]),
      }),
    );
    // Mock GCal as not configured
    await page.route('**/api/v1/gcal/auth/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false, authenticated: false, mode: null }),
      }),
    );
    await page.goto('/tasks');
  });

  test('create form shows JIRA source tab when configured', async ({ page }) => {
    await page.getByText('+ Create').click();
    await expect(page.locator('.task-board__source-selector')).toBeVisible();
    await expect(page.getByRole('button', { name: 'JIRA' })).toBeVisible();
  });

  test('selecting a JIRA ticket pre-fills the form', async ({ page }) => {
    await page.getByText('+ Create').click();
    await page.getByRole('button', { name: 'JIRA' }).click();

    // Wait for tickets to load
    await expect(page.getByText('Fix login bug')).toBeVisible();

    // Click on a ticket
    await page.getByText('Fix login bug').click();

    // Should switch to manual mode with pre-filled title
    await expect(page.locator('input[placeholder="Task title"]')).toHaveValue('Fix login bug');
    await expect(page.locator('input[placeholder="JAR-123 or full URL"]')).toHaveValue('JAR-1');
  });
});

test.describe('Task Import — Google Calendar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock JIRA as not configured
    await page.route('**/api/v1/jira/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false, projectUrl: null }),
      }),
    );
    // Mock GCal as configured and authenticated
    await page.route('**/api/v1/gcal/auth/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, authenticated: true, mode: 'service_account' }),
      }),
    );
    // Mock GCal events
    await page.route('**/api/v1/gcal/events*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            calendar_name: 'Work',
            calendar_color: '#4285f4',
            events: [
              { id: 'ev1', summary: 'Sprint Planning', start: '2026-04-03T09:00:00Z', end: '2026-04-03T10:00:00Z', calendar_name: 'Work', calendar_color: '#4285f4' },
            ],
          },
        ]),
      }),
    );
    await page.goto('/tasks');
  });

  test('create form shows Google Calendar source tab when configured', async ({ page }) => {
    await page.getByText('+ Create').click();
    await expect(page.getByRole('button', { name: 'Google Calendar' })).toBeVisible();
  });

  test('selecting a calendar event pre-fills the form', async ({ page }) => {
    await page.getByText('+ Create').click();
    await page.getByRole('button', { name: 'Google Calendar' }).click();

    // Wait for events to load
    await expect(page.getByText('Sprint Planning')).toBeVisible();

    // Click on an event
    await page.getByText('Sprint Planning').click();

    // Should switch to manual mode with pre-filled title
    await expect(page.locator('input[placeholder="Task title"]')).toHaveValue('Sprint Planning');
  });
});
