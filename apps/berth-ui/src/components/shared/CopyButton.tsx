import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    await navigator.clipboard.writeText(value);
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
