import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNav } from '@/layout/MobileNav';
import { ThemeToggle } from '@/layout/ThemeToggle';
import { useAuth, useLogout } from '@/hooks/useAuth';

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Topbar() {
  const { user } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const displayName = user?.name ?? 'Admin';

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-md pt-[env(safe-area-inset-top)] md:px-6">
      <MobileNav />

      <form
        role="search"
        className="relative hidden max-w-sm flex-1 sm:block"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          navigate(`/services?q=${encodeURIComponent(String(value ?? ''))}`);
        }}
      >
        <Label htmlFor="global-search" className="sr-only">
          Search services and servers
        </Label>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id="global-search"
          name="q"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search services, servers…"
          className="bg-muted/50 h-9 pl-9"
        />
      </form>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/services/new">
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Service</span>
            <span className="sr-only sm:hidden">New Service</span>
          </Link>
        </Button>
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label={`Account menu for ${displayName}`}
            >
              <Avatar className="size-8">
                {user?.avatarUrl ? (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                  />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium" translate="no">
                  {displayName}
                </span>
                <span
                  className="text-muted-foreground text-xs font-normal"
                  translate="no"
                >
                  {user?.email ?? 'not signed in'}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <UserRound className="size-4" aria-hidden="true" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
