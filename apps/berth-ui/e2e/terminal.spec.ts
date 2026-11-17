import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const encode = (text: string) => Buffer.from(text).toString('base64');

test.describe('container terminal', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.routeWebSocket(/\/exec/, (socket) => {
      socket.send(JSON.stringify({ type: 'ExecOutput', data: encode('root@abc123:/app# ') }));
      socket.onMessage((message) => {
        const parsed = JSON.parse(String(message));
        if (parsed.type === 'input') socket.send(JSON.stringify({ type: 'ExecOutput', data: parsed.data }));
      });
    });
  });

  test('shows what you type', async ({ page }) => {
    await page.goto('/services/svc-web?tab=terminal');
    await page.locator('.xterm').click();
    await page.keyboard.type('echo hello world');

    await expect(page.locator('.xterm-rows')).toContainText('root@abc123:/app# echo hello world');
  });

  test('renders with a real monospace font, not an unresolved CSS variable', async ({ page }) => {
    await page.goto('/services/svc-web?tab=terminal');
    await expect(page.locator('.xterm-rows')).toContainText('root@abc123:/app#');

    const fontFamily = await page.locator('.xterm-rows').evaluate((element) => getComputedStyle(element).fontFamily);
    expect(fontFamily).not.toContain('var(');
    expect(fontFamily.toLowerCase()).toContain('monospace');
  });

  test('reports the connection state', async ({ page }) => {
    await page.goto('/services/svc-web?tab=terminal');
    await expect(page.getByText('connected')).toBeVisible();
  });
});
