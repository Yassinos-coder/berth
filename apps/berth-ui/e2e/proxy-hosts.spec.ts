import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

async function openDialog(page: Page) {
  await page.goto('/proxy-hosts');
  await page.getByRole('button', { name: 'Add proxy host' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function pickService(page: Page, name: string) {
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: new RegExp(name) }).click();
}

test.describe('DNS pre-check', () => {
  test('explains what to do before a domain is entered', async ({ page }) => {
    await mockApi(page);
    await openDialog(page);
    await expect(page.getByText(/Point your domain's DNS A record/)).toBeVisible();
  });

  test('confirms a domain that points at the server', async ({ page }) => {
    const calls = await mockApi(page);
    await openDialog(page);
    await pickService(page, 'storefront');
    await page.getByLabel('Domain').fill('app.example.com');

    const notice = page.locator('[data-dns-status]');
    await expect(notice).toHaveAttribute('data-dns-status', 'ok');
    await expect(notice).toContainText('points to this server');
    expect(calls.some((call) => call.path === '/proxy-hosts/dns-check' && call.search.includes('serviceId=svc-web'))).toBe(true);
  });

  test('warns when the record points somewhere else', async ({ page }) => {
    await mockApi(page, {
      dns: {
        status: 'mismatch',
        message: 'app.example.com resolves to 1.2.3.4, not this server (203.0.113.7).',
        resolved: ['1.2.3.4'],
        expectedIp: '203.0.113.7',
      },
    });
    await openDialog(page);
    await pickService(page, 'storefront');
    await page.getByLabel('Domain').fill('app.example.com');

    const notice = page.locator('[data-dns-status]');
    await expect(notice).toHaveAttribute('data-dns-status', 'mismatch');
    await expect(notice).toContainText('1.2.3.4');
  });

  test('does not call the API for an incomplete domain', async ({ page }) => {
    const calls = await mockApi(page);
    await openDialog(page);
    await pickService(page, 'storefront');
    await page.getByLabel('Domain').fill('not-a-domain');
    await page.waitForTimeout(900);
    expect(calls.some((call) => call.path === '/proxy-hosts/dns-check')).toBe(false);
  });

  test('still allows adding the host when DNS is not ready', async ({ page }) => {
    await mockApi(page, { dns: { status: 'unresolved', message: 'No DNS record found yet.' } });
    await openDialog(page);
    await pickService(page, 'storefront');
    await page.getByLabel('Domain').fill('app.example.com');
    await expect(page.locator('[data-dns-status]')).toHaveAttribute('data-dns-status', 'unresolved');
    await expect(page.getByRole('button', { name: 'Add host' })).toBeEnabled();
  });
});
