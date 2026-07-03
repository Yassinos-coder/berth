import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useThemeStore } from '@/store/themeStore';

function Toaster(props: ToasterProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
