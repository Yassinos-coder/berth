import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function fallbackCopy(value: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyButton({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
    } catch {
      fallbackCopy(value);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={label ? 'sm' : 'icon'}
      onClick={copy}
      className={cn(className)}
    >
      {copied ? (
        <Check className="text-success size-4" />
      ) : (
        <Copy className="size-4" />
      )}
      {label ? <span>{copied ? 'Copied' : label}</span> : null}
    </Button>
  );
}
