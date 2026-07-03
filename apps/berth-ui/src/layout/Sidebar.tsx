import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { NAV_SECTIONS } from '@/layout/nav';
import { BrandMark } from '@/layout/BrandMark';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 md:flex',
        sidebarCollapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border px-4',
          sidebarCollapsed && 'justify-center px-0',
        )}
      >
        <BrandMark collapsed={sidebarCollapsed} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="space-y-1">
            {section.title && !sidebarCollapsed ? (
              <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => {
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground',
                      sidebarCollapsed && 'justify-center px-0',
                    )
                  }
                >
                  <item.icon className="size-4.5 shrink-0" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </NavLink>
              );

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="size-4.5" />
          ) : (
            <>
              <PanelLeftClose className="size-4.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
