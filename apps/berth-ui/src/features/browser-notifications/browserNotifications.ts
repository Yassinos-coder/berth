const PREF_KEY = 'berth:browser-notifications';
const DISMISSED_KEY = 'berth:browser-notifications-dismissed';

export interface BrowserNotice {
  title: string;
  body: string;
  tag: string;
  url: string;
}

export class BrowserNotifications {
  static supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  static permission(): NotificationPermission | 'unsupported' {
    return BrowserNotifications.supported() ? Notification.permission : 'unsupported';
  }

  static enabled(): boolean {
    return BrowserNotifications.permission() === 'granted' && BrowserNotifications.read(PREF_KEY) !== 'off';
  }

  static shouldPrompt(): boolean {
    return BrowserNotifications.permission() === 'default' && BrowserNotifications.read(DISMISSED_KEY) !== '1';
  }

  static dismissPrompt(): void {
    BrowserNotifications.write(DISMISSED_KEY, '1');
  }

  static setEnabled(on: boolean): void {
    BrowserNotifications.write(PREF_KEY, on ? 'on' : 'off');
  }

  static async request(): Promise<NotificationPermission | 'unsupported'> {
    if (!BrowserNotifications.supported()) return 'unsupported';
    const result = await BrowserNotifications.ask();
    if (result === 'granted') BrowserNotifications.setEnabled(true);
    return result;
  }

  static userIsAway(): boolean {
    return document.visibilityState === 'hidden' || !document.hasFocus();
  }

  static async show(notice: BrowserNotice): Promise<boolean> {
    if (!BrowserNotifications.enabled()) return false;
    const options: NotificationOptions = { body: notice.body, tag: notice.tag, icon: '/favicon.svg' };
    try {
      const registration = await BrowserNotifications.registration();
      if (registration) {
        await registration.showNotification(notice.title, { ...options, data: { url: notice.url } });
        return true;
      }
      const shown = new Notification(notice.title, options);
      shown.onclick = () => {
        window.focus();
        window.location.assign(notice.url);
        shown.close();
      };
      return true;
    } catch {
      return false;
    }
  }

  private static ask(): Promise<NotificationPermission> {
    try {
      const pending = Notification.requestPermission((value) => value);
      return pending ?? Promise.resolve(Notification.permission);
    } catch {
      return Promise.resolve(Notification.permission);
    }
  }

  private static async registration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  }

  private static read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private static write(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  }
}
