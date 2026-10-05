import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

test.describe('templates catalog', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/templates');
    await expect(page.getByText('PostgreSQL')).toBeVisible();
  });

  test('lists databases and apps together', async ({ page }) => {
    await expect(page.getByText('n8n', { exact: true })).toBeVisible();
    await expect(page.getByText('Grafana')).toBeVisible();
  });

  test('filters by category', async ({ page }) => {
    await page.getByRole('button', { name: 'Apps' }).click();
    await expect(page.getByText('n8n', { exact: true })).toBeVisible();
    await expect(page.getByText('PostgreSQL')).toBeHidden();
  });

  test('searches by name and description', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('dashboards');
    await expect(page.getByText('Grafana')).toBeVisible();
    await expect(page.getByText('Redis')).toBeHidden();
  });

  test('shows an empty state when nothing matches', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search templates' }).fill('nonexistent');
    await expect(page.getByText('No templates found')).toBeVisible();
  });

  test('opens the new service form preset to the template', async ({ page }) => {
    await page.getByRole('link', { name: /n8n/ }).click();
    await expect(page).toHaveURL(/\/services\/new\?template=tpl_n8n/);
    await expect(page.getByText('Secrets are generated for you')).toBeVisible();
  });
});
