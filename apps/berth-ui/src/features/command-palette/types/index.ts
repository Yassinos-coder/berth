export interface PaletteItem {
  id: string;
  group: 'Actions' | 'Pages' | 'Services' | 'Servers';
  label: string;
  hint?: string;
  keywords: string;
  to?: string;
  action?: 'toggle-theme';
}
