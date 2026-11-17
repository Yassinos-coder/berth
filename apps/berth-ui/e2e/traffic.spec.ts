import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const series = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ ts: 1_000_000 + index * 60_000, requests: 10 + index, errors5xx: 0 }));

test.describe('traffic', () => {
  test('shows requests, error rate and latency', async ({ page }) => {
    await mockApi(page, {
      traffic: { hasTraffic: true, requests: 12_400, errors4xx: 310, errors5xx: 62, errorRatePct: 0.5, p95Ms: 240, series: series(8) },
    });
    await page.goto('/services/svc-web?tab=metrics');
    const card = page.getByTestId('traffic-card');
    await expect(card).toContainText('12k');
    await expect(card).toContainText('0.5%');
    await expect(card).toContainText('240 ms');
  });

  test('says so plainly when nobody has visited yet', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web?tab=metrics');
    await expect(page.getByTestId('traffic-card')).toContainText('No requests yet');
  });

  test('asks for the range that is selected', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=metrics');
    await page.getByRole('button', { name: '7d', exact: true }).click();
    await expect.poll(() => calls.some((call) => call.path === '/services/svc-web/traffic' && call.search.includes('range=7d'))).toBe(true);
  });
});
