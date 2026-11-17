import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const MEMORY_FINDING = {
  id: 'f1',
  kind: 'resources',
  severity: 'warning',
  source: 'rules',
  status: 'open',
  title: 'api peaked at 1 GB of memory',
  detail: 'It used up to 1,010 MB yesterday but is limited to 512 MB.',
  evidence: ['Peak memory 1,010 MB over 7 days'],
  serviceId: 'svc-git',
  serviceName: 'api',
  action: { type: 'set-resources', serviceId: 'svc-git', memoryMb: 1536 },
  actionLabel: 'Change api: memory 512 MB → 1536 MB',
  createdAt: '2026-11-17T10:00:00.000Z',
  canUndo: false,
};

test.describe('AI advisor', () => {
  test('shows the number of suggestions in the header', async ({ page }) => {
    await mockApi(page, { advisor: { enabled: true, findings: [MEMORY_FINDING] } });
    await page.goto('/');
    await expect(page.getByTestId('advisor-badge')).toHaveText('1');
    await page.getByRole('link', { name: /AI advisor, 1 suggestion/ }).click();
    await expect(page).toHaveURL(/\/advisor$/);
    await expect(page.getByText('api peaked at 1 GB of memory')).toBeVisible();
    await expect(page.getByText('Change api: memory 512 MB → 1536 MB')).toBeVisible();
  });

  test('hides the header icon when the advisor is off', async ({ page }) => {
    await mockApi(page, { advisor: { enabled: false } });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /AI advisor/ })).toHaveCount(0);
  });

  test('applying a suggestion calls the API and offers undo', async ({ page }) => {
    const calls = await mockApi(page, { advisor: { enabled: true, findings: [MEMORY_FINDING] } });
    await page.goto('/advisor');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect
      .poll(() => calls.some((call) => call.method === 'POST' && call.path === '/advisor/findings/f1/apply'))
      .toBe(true);
    await expect(page.getByText('Nothing to suggest')).toBeVisible();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  });

  test('declining a suggestion removes it', async ({ page }) => {
    const calls = await mockApi(page, { advisor: { enabled: true, findings: [MEMORY_FINDING] } });
    await page.goto('/advisor');
    await page.getByRole('button', { name: 'Decline' }).click();

    await expect
      .poll(() => calls.some((call) => call.path === '/advisor/findings/f1/dismiss'))
      .toBe(true);
    await expect(page.getByText('Nothing to suggest')).toBeVisible();
  });

  test('viewers cannot apply or decline', async ({ page }) => {
    await mockApi(page, { role: 'viewer', advisor: { enabled: true, findings: [MEMORY_FINDING] } });
    await page.goto('/advisor');
    await expect(page.getByText('api peaked at 1 GB of memory')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Analyze now' })).toHaveCount(0);
  });

  test('points to settings when it is turned off', async ({ page }) => {
    await mockApi(page, { advisor: { enabled: false } });
    await page.goto('/advisor');
    await expect(page.getByText('The advisor is turned off')).toBeVisible();
  });

  test('analyze now runs an analysis', async ({ page }) => {
    const calls = await mockApi(page, { advisor: { enabled: true } });
    await page.goto('/advisor');
    await page.getByRole('button', { name: 'Analyze now' }).click();
    await expect.poll(() => calls.some((call) => call.path === '/advisor/run')).toBe(true);
  });

  test('settings never show the saved key', async ({ page }) => {
    await mockApi(page, { advisor: { enabled: true } });
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Resources' }).click();
    await expect(page.getByLabel('API key')).toHaveValue('');
    await expect(page.getByLabel('API key')).toHaveAttribute('placeholder', /Saved/);
    await expect(page.getByLabel('API URL')).toBeDisabled();
  });
});
