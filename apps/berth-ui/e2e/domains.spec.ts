import { expect, test } from '@playwright/test';
import { mockApi, PROXY_HOST } from './fixtures/mockApi';

test.describe('editing a proxy host', () => {
  test('changes the domain and sends only what changed', async ({ page }) => {
    const calls = await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/proxy-hosts');

    await page.getByRole('button', { name: 'Edit proxy host shop.example.com' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Domain')).toHaveValue('shop.example.com');
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await dialog.getByLabel('Domain').fill('store.example.com');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/proxy-hosts/ph-1')?.body)
      .toEqual({ domain: 'store.example.com' });
  });

  test('scopes a host to a path and previews the address', async ({ page }) => {
    const calls = await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/proxy-hosts');
    await page.getByRole('button', { name: 'Edit proxy host shop.example.com' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Path').fill('/api');
    await expect(dialog.getByTestId('proxy-host-preview')).toContainText('https://shop.example.com/api');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH')?.body)
      .toEqual({ path: '/api' });
  });

  test('turning HTTPS off also turns force-HTTPS off', async ({ page }) => {
    const calls = await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/proxy-hosts');
    await page.getByRole('button', { name: 'Edit proxy host shop.example.com' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('switch', { name: 'Automatic HTTPS' }).click();
    await expect(dialog.getByRole('switch', { name: 'Force HTTPS' })).toBeDisabled();
    await expect(dialog.getByTestId('proxy-host-preview')).toContainText('http://shop.example.com');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH')?.body)
      .toEqual({ ssl: false, forceHttps: false });
  });

  test('rejects an invalid domain and keeps Save disabled', async ({ page }) => {
    await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/proxy-hosts');
    await page.getByRole('button', { name: 'Edit proxy host shop.example.com' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Domain').fill('https://shop.example.com');
    await expect(dialog.getByText(/Enter a valid domain/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  test('the card links to the domain and to its service', async ({ page }) => {
    await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/proxy-hosts');

    const domain = page.getByRole('link', { name: /shop\.example\.com/ });
    await expect(domain).toHaveAttribute('href', 'https://shop.example.com');
    await expect(domain).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: 'storefront' })).toHaveAttribute('href', '/services/svc-web');
    await expect(page.getByText(/redirects HTTP to HTTPS/)).toBeVisible();
  });
});

test.describe('domains on services', () => {
  test('the services list shows clickable domains without breaking the card link', async ({ page }) => {
    await mockApi(page, { proxyHosts: [PROXY_HOST, { ...PROXY_HOST, id: 'ph-2', domain: 'api.example.com', path: '/v1', ssl: false }] });
    await page.goto('/services');

    const shop = page.getByRole('link', { name: /shop\.example\.com/ });
    await expect(shop).toHaveAttribute('href', 'https://shop.example.com');
    await expect(shop).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: /api\.example\.com\/v1/ })).toHaveAttribute('href', 'http://api.example.com/v1');

    await page.getByRole('link', { name: 'storefront', exact: true }).click();
    await expect(page).toHaveURL(/\/services\/svc-web$/);
  });

  test('search finds a service by its domain', async ({ page }) => {
    await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/services');

    await page.getByRole('searchbox', { name: 'Search services by name or domain' }).fill('shop.example');
    await expect(page.getByRole('link', { name: 'storefront', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'orders-db', exact: true })).toHaveCount(0);
  });

  test('the service page shows its domains under the title', async ({ page }) => {
    await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/services/svc-web');

    const domains = page.getByTestId('service-domains');
    await expect(domains.getByRole('link', { name: /shop\.example\.com/ })).toHaveAttribute('href', 'https://shop.example.com');
    await domains.getByRole('link', { name: 'Manage domains' }).click();
    await expect(page).toHaveURL(/tab=domains/);
  });

  test('a service without a domain offers to add one', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web');

    await expect(page.getByText('Not reachable from the internet yet.')).toBeVisible();
    await page.getByRole('link', { name: 'Add a domain' }).click();
    await expect(page).toHaveURL(/tab=domains/);
  });

  test('a database never suggests a public domain', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-db');

    await expect(page.getByText('Not reachable from the internet yet.')).toHaveCount(0);
  });

  test('the Domains tab edits in place and confirms before deleting', async ({ page }) => {
    const calls = await mockApi(page, { proxyHosts: [PROXY_HOST] });
    await page.goto('/services/svc-web?tab=domains');

    await expect(page.getByRole('button', { name: 'Edit proxy host shop.example.com' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete proxy host shop.example.com' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

    await page.getByRole('button', { name: 'Delete Proxy Host' }).click();
    await expect.poll(() => calls.some((call) => call.method === 'DELETE' && call.path === '/proxy-hosts/ph-1')).toBe(true);
  });
});
