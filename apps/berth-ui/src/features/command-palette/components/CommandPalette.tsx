import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useServers } from '@/hooks/useServersQueries';
import { useServices } from '@/hooks/useServicesQueries';
import { useThemeStore } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import type { PaletteItem } from '@/features/command-palette/types';
import { PaletteItems } from '@/features/command-palette/utils/paletteItems';

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const services = useServices();
  const servers = useServers();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(!useUiStore.getState().commandOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setActive(0);
  }, [open]);

  const results = useMemo(
    () =>
      PaletteItems.filter(
        PaletteItems.build({ services: services.data ?? [], servers: servers.data ?? [] }),
        query,
      ),
    [services.data, servers.data, query],
  );

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    if (item.action === 'toggle-theme') return toggleTheme();
    if (item.to) navigate(item.to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, services and servers, then press Enter to open.
        </DialogDescription>
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
          aria-label="Search commands"
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a command or search…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="placeholder:text-muted-foreground border-border w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul
          id="command-palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-center text-sm">No results.</li>
          ) : (
            results.map((item, index) => (
              <li
                key={item.id}
                id={`palette-${item.id}`}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm',
                  index === active && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {item.hint ? `${item.hint} · ` : ''}
                  {item.group}
                </span>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
