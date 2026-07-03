import {
  LayoutDashboard,
  Server,
  Boxes,
  Rocket,
  LayoutTemplate,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Overview', to: '/', icon: LayoutDashboard, end: true },
      { label: 'Services', to: '/services', icon: Boxes },
      { label: 'Servers', to: '/servers', icon: Server },
      { label: 'Deployments', to: '/deployments', icon: Rocket },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Templates', to: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    title: 'Organization',
    items: [
      { label: 'Team', to: '/team', icon: Users },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];
