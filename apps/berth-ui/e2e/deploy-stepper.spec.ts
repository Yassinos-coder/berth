import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const deployment = (status: string) => ({
  id: 'dep1',
  serviceId: 'svc-web',
  serviceName: 'storefront',
  status,
  trigger: 'push',
  branch: 'main',
  commitSha: 'abcdef1',
  createdAt: new Date().toISOString(),
});

const buildLine = (id: string, line: string) => ({ id, ts: Number(id), stream: 'build', line });

const stage = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-stage="${id}"]`);

test.describe('deploy progress stepper', () => {
  test('shows the stage that is running right now', async ({ page }) => {
    await mockApi(page, {
      deployments: [deployment('building')],
      logs: [
        buildLine('1', '==> Build started'),
        buildLine('2', '==> Cloning branch main'),
        buildLine('3', '==> Building with Dockerfile'),
        buildLine('4', 'Step 3/9 : RUN npm ci'),
      ],
    });
    await page.goto('/services/svc-web?tab=deployments');

    await expect(page.getByText('Deploying now')).toBeVisible();
    await expect(stage(page, 'clone')).toHaveAttribute('data-state', 'done');
    await expect(stage(page, 'build')).toHaveAttribute('data-state', 'active');
    await expect(stage(page, 'start')).toHaveAttribute('data-state', 'pending');
    await expect(stage(page, 'health')).toHaveAttribute('data-state', 'pending');
  });

  test('moves on to the health check', async ({ page }) => {
    await mockApi(page, {
      deployments: [deployment('deploying')],
      logs: [
        buildLine('1', '==> Building with Dockerfile'),
        buildLine('2', '==> Build finished'),
        buildLine('3', '==> Starting container'),
        buildLine('4', '==> Waiting for health check'),
      ],
    });
    await page.goto('/services/svc-web?tab=deployments');
    await expect(stage(page, 'build')).toHaveAttribute('data-state', 'done');
    await expect(stage(page, 'start')).toHaveAttribute('data-state', 'done');
    await expect(stage(page, 'health')).toHaveAttribute('data-state', 'active');
  });

  test('marks the failing stage and links to the build logs', async ({ page }) => {
    await mockApi(page, {
      deployments: [deployment('failed')],
      logs: [buildLine('1', '==> Cloning branch main'), buildLine('2', '==> Building with Dockerfile')],
    });
    await page.goto('/services/svc-web?tab=deployments');

    await expect(page.getByText('Latest deployment failed')).toBeVisible();
    await expect(stage(page, 'clone')).toHaveAttribute('data-state', 'done');
    await expect(stage(page, 'build')).toHaveAttribute('data-state', 'failed');

    await page.getByRole('link', { name: 'View build logs' }).click();
    await expect(page).toHaveURL(/tab=logs&logs=build/);
    await expect(page.getByText('==> Building with Dockerfile')).toBeVisible();
  });

  test('shows every stage complete for a live deployment', async ({ page }) => {
    await mockApi(page, { deployments: [deployment('live')], logs: [] });
    await page.goto('/services/svc-web?tab=deployments');
    for (const id of ['clone', 'build', 'start', 'health']) {
      await expect(stage(page, id)).toHaveAttribute('data-state', 'done');
    }
  });

  test('uses the image steps for image services', async ({ page }) => {
    await mockApi(page, {
      deployments: [{ ...deployment('deploying'), serviceId: 'svc-db', serviceName: 'orders-db' }],
      logs: [buildLine('1', '==> Deploy started'), buildLine('2', '==> Pulling image postgres:16-alpine')],
    });
    await page.goto('/services/svc-db?tab=deployments');
    await expect(stage(page, 'pull')).toHaveAttribute('data-state', 'active');
    await expect(stage(page, 'clone')).toHaveCount(0);
  });
});
