import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { NAV_SECTIONS } from '@/layout/nav';
import { BrandMark } from '@/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden" />
        <DialogPrimitive.Content
          className="bg-sidebar text-sidebar-foreground border-sidebar-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] flex-col border-r overscroll-contain pl-[env(safe-area-inset-left)] shadow-xl duration-200 md:hidden"
          aria-label="Main navigation"
        >
          <DialogPrimitive.Title className="sr-only">
            Navigation
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Move between the panel’s sections.
          </DialogPrimitive.Description>

          <div className="border-sidebar-border flex h-14 shrink-0 items-center justify-between border-b px-4">
            <BrandMark />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close navigation menu">
                <X className="size-4.5" aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 py-5">
            {NAV_SECTIONS.map((section, i) => (
              <div key={i} className="space-y-1">
                {section.title ? (
                  <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                    {section.title}
                  </p>
                ) : null}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        'focus-visible:ring-ring/40 outline-none focus-visible:ring-[3px]',
                        'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive &&
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
