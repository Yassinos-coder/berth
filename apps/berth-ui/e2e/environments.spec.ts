import { expect, test } from '@playwright/test';
import { DB_SERVICE, GIT_SERVICE, mockApi } from './fixtures/mockApi';

const ENVIRONMENTS = [
  { id: 'env-stg', name: 'Staging', slug: 'staging', isProduction: false, preview: false, _count: { services: 1 } },
  { id: 'env-prod', name: 'Production', slug: 'production', isProduction: true, preview: false, _count: { services: 1 } },
];

const WORKER = { ...GIT_SERVICE, id: 'svc-worker', name: 'worker' };

const grouped = [
  { ...GIT_SERVICE, environmentId: 'env-prod', environmentName: 'Production' },
  { ...DB_SERVICE, environmentId: 'env-stg', environmentName: 'Staging' },
  WORKER,
];

test.describe('services grouped by environment', () => {
  test('groups automatically, production first and unassigned last', async ({ page }) => {
    await mockApi(page, { services: grouped, environments: ENVIRONMENTS });
    await page.goto('/services');

    const headings = page.locator('section h2');
    await expect(headings).toHaveText(['Production', 'Staging', 'No environment']);
    await expect(page.locator('section', { hasText: 'Production' }).getByText('storefront', { exact: true })).toBeVisible();
    await expect(page.locator('section', { hasText: 'No environment' }).getByText('worker', { exact: true })).toBeVisible();
  });

  test('can be switched back to a flat list', async ({ page }) => {
    await mockApi(page, { services: grouped, environments: ENVIRONMENTS });
    await page.goto('/services');
    await page.getByRole('button', { name: 'Ungroup' }).click();

    await expect(page).toHaveURL(/group=none/);
    await expect(page.locator('section h2')).toHaveCount(0);
    await expect(page.getByText('storefront', { exact: true })).toBeVisible();
    await expect(page.getByText('worker', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Group by environment' })).toBeVisible();
  });

  test('filters to one environment', async ({ page }) => {
    await mockApi(page, { services: grouped, environments: ENVIRONMENTS });
    await page.goto('/services');
    await page.getByRole('combobox', { name: 'Filter by environment' }).click();
    await page.getByRole('option', { name: 'Staging' }).click();

    await expect(page.getByText('orders-db', { exact: true })).toBeVisible();
    await expect(page.getByText('storefront', { exact: true })).toBeHidden();
    await expect(page.getByText('worker', { exact: true })).toBeHidden();
  });

  test('filters to services without an environment', async ({ page }) => {
    await mockApi(page, { services: grouped, environments: ENVIRONMENTS });
    await page.goto('/services?env=none');
    await expect(page.getByText('worker', { exact: true })).toBeVisible();
    await expect(page.getByText('storefront', { exact: true })).toBeHidden();
  });

  test('stays a plain list when nothing is assigned', async ({ page }) => {
    await mockApi(page, { services: [GIT_SERVICE, DB_SERVICE], environments: ENVIRONMENTS });
    await page.goto('/services');
    await expect(page.getByText('storefront', { exact: true })).toBeVisible();
    await expect(page.locator('section h2')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Group by environment' })).toHaveCount(0);
  });

  test('shows the environment filter only when environments exist', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services');
    await expect(page.getByText('storefront', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filter by environment' })).toHaveCount(0);
  });
});

test.describe('assigning an environment', () => {
  test('moves a service into an environment from its settings', async ({ page }) => {
    const calls = await mockApi(page, { environments: ENVIRONMENTS });
    await page.goto('/services/svc-web?tab=settings');

    await page.getByRole('combobox', { name: 'Environment' }).click();
    await page.getByRole('option', { name: 'Staging' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/environments/assign/svc-web')?.body)
      .toEqual({ environmentId: 'env-stg' });
  });

  test('clears the environment with null', async ({ page }) => {
    const calls = await mockApi(page, {
      environments: ENVIRONMENTS,
      services: [{ ...GIT_SERVICE, environmentId: 'env-prod', environmentName: 'Production' }, DB_SERVICE],
    });
    await page.goto('/services/svc-web?tab=settings');

    await page.getByRole('combobox', { name: 'Environment' }).click();
    await page.getByRole('option', { name: 'No environment' }).click();

    await expect
      .poll(() => calls.find((call) => call.path === '/environments/assign/svc-web')?.body)
      .toEqual({ environmentId: null });
  });

  test('offers the environment choice when creating a service', async ({ page }) => {
    await mockApi(page, { environments: ENVIRONMENTS });
    await page.goto('/services/new?template=tpl_n8n');
    await expect(page.getByText('Environment (optional)')).toBeVisible();
  });
});

test.describe('managing environments', () => {
  test('creates an environment from settings', async ({ page }) => {
    const calls = await mockApi(page, { environments: ENVIRONMENTS });
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Environments' }).click();

    await expect(page.getByText('Production', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Environment name').fill('QA');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'POST' && call.path === '/environments')?.body)
      .toEqual({ name: 'QA', preview: false, isProduction: false });
  });

  test('does not allow deleting an environment that has services', async ({ page }) => {
    await mockApi(page, { environments: ENVIRONMENTS });
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Environments' }).click();
    await expect(page.getByRole('button', { name: 'Delete Production' })).toBeDisabled();
  });
});
