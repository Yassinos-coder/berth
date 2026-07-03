import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/layout/Sidebar';
import { Topbar } from '@/layout/Topbar';

export function AppShell() {
  return (
    <div className="bg-background flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
