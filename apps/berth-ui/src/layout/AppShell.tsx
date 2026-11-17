import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/layout/Sidebar';
import { Topbar } from '@/layout/Topbar';
import { Footer } from '@/layout/Footer';
import { NotificationPrompt } from '@/features/browser-notifications/NotificationPrompt';
import { useBrowserNotifier } from '@/features/browser-notifications/hooks/useBrowserNotifier';
import { CommandPalette } from '@/features/command-palette/components/CommandPalette';

export function AppShell() {
  useBrowserNotifier();
  return (
    <div className="bg-background flex min-h-screen">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus-visible:ring-ring/40 sr-only rounded-md px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to main content
      </a>
      <CommandPalette />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none md:px-8 md:py-8"
        >
          <div className="mb-6 empty:hidden">
            <NotificationPrompt />
          </div>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
