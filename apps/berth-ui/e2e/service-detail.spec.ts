import { expect, test } from '@playwright/test';
import { GIT_SERVICE, mockApi } from './fixtures/mockApi';

test.describe('service detail', () => {
  test('falls back to Overview for a removed or unknown tab', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web?tab=jobs');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('tab', { name: 'Jobs' })).toHaveCount(0);
  });

  test('logs tab separates runtime and build output', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web?tab=logs');

    await expect(page.getByText('server listening on :3000')).toBeVisible();
    await expect(page.getByText('==> Build started')).toBeHidden();

    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await expect(page.getByText('==> Build started')).toBeVisible();
    await expect(page.getByText('==> Building with Dockerfile')).toBeVisible();
    await expect(page.getByText('server listening on :3000')).toBeHidden();
    await expect(page).toHaveURL(/logs=build/);

    await page.getByRole('button', { name: 'Runtime', exact: true }).click();
    await expect(page.getByText('server listening on :3000')).toBeVisible();
  });

  test('metrics tab loads history for the chosen range', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=metrics');

    await page.getByRole('button', { name: '24h', exact: true }).click();
    await expect.poll(() => calls.some((call) => call.path.endsWith('/metrics/history') && call.search === '?range=24h')).toBe(true);

    await page.getByRole('button', { name: '7d', exact: true }).click();
    await expect.poll(() => calls.some((call) => call.search === '?range=7d')).toBe(true);
  });

  test('preview environments toggle saves the setting', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');

    await page.getByRole('switch', { name: 'Deploy every pull request' }).click();
    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ previewsEnabled: true });
  });

  test('does not offer preview environments for database services', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-db?tab=settings');
    await expect(page.getByText('Delete this service')).toBeVisible();
    await expect(page.getByText('Preview environments')).toHaveCount(0);
  });
});

test.describe('deploy strategy', () => {
  test('choosing Run once saves the strategy', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByRole('radio', { name: /Zero downtime/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: /Run once/ }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ deployStrategy: 'recreate' });
  });

  test('Run once is unavailable while the service is replicated', async ({ page }) => {
    await mockApi(page, { services: [{ ...GIT_SERVICE, replicas: 3 }] });
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByRole('radio', { name: /Run once/ })).toBeDisabled();
    await expect(page.getByText('Set replicas to 1 before choosing Run once.')).toBeVisible();
  });

  test('a run-once service shows it as selected', async ({ page }) => {
    await mockApi(page, { services: [{ ...GIT_SERVICE, deployStrategy: 'recreate' }] });
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByRole('radio', { name: /Run once/ })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('automatic rollback', () => {
  test('is on by default and can be turned off', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');

    const toggle = page.getByRole('switch', { name: 'Roll back automatically' });
    await expect(toggle).toBeChecked();
    await toggle.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ autoRollback: false });
  });
});
