import type { ReactNode } from 'react';
import { BrandMark } from '@/layout/BrandMark';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="bg-primary/10 pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
        </div>
        {children}
        {footer ? (
          <p className="text-muted-foreground mt-6 text-center text-sm">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
