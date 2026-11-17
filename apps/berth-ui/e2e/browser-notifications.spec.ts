import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

async function fakeNotifications(page: Page, initial: 'default' | 'granted' | 'denied', answer: 'granted' | 'denied') {
  await page.addInitScript(
    ({ initial, answer }) => {
      const stored = window.sessionStorage.getItem('fake-permission');
      class FakeNotification {
        static permission = (stored ?? initial) as NotificationPermission;
        static requestPermission() {
          FakeNotification.permission = answer;
          window.sessionStorage.setItem('fake-permission', answer);
          return Promise.resolve(answer);
        }
        constructor(title: string, options?: NotificationOptions) {
          const log = JSON.parse(window.sessionStorage.getItem('fake-shown') ?? '[]');
          log.push({ title, body: options?.body });
          window.sessionStorage.setItem('fake-shown', JSON.stringify(log));
        }
        close() {}
      }
      Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
    },
    { initial, answer },
  );
}

test.describe('browser notifications', () => {
  test('asks first, then reloads once the browser allows it', async ({ page }) => {
    await mockApi(page);
    await fakeNotifications(page, 'default', 'granted');
    await page.goto('/');

    await expect(page.getByText(/Get a browser notification when a build finishes/)).toBeVisible();
    const reload = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Enable notifications' }).click();
    await reload;

    await expect(page.getByText(/Get a browser notification when a build finishes/)).toHaveCount(0);
    expect(await page.evaluate(() => window.localStorage.getItem('berth:browser-notifications'))).toBe('on');
  });

  test('stays quiet after the user says not now', async ({ page }) => {
    await mockApi(page);
    await fakeNotifications(page, 'default', 'granted');
    await page.goto('/');
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.reload();
    await expect(page.getByText(/Get a browser notification when a build finishes/)).toHaveCount(0);
  });

  test('does not ask when permission was already decided', async ({ page }) => {
    await mockApi(page);
    await fakeNotifications(page, 'denied', 'denied');
    await page.goto('/');
    await expect(page.getByText(/Get a browser notification when a build finishes/)).toHaveCount(0);
  });

  test('explains a blocked browser in settings', async ({ page }) => {
    await mockApi(page);
    await fakeNotifications(page, 'denied', 'denied');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Notifications' }).click();
    await expect(page.getByText(/blocked for this site/)).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Notify me in this browser' })).toBeDisabled();
  });

  test('settings can send a test notification when allowed', async ({ page }) => {
    await mockApi(page);
    await fakeNotifications(page, 'granted', 'granted');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Notifications' }).click();
    await page.getByRole('button', { name: 'Send a test notification' }).click();
    await expect
      .poll(() => page.evaluate(() => window.sessionStorage.getItem('fake-shown')))
      .toContain('Berth notifications are on');
  });
});
