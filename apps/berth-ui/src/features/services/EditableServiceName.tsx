import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useRenameService } from '@/hooks/useServicesMutations';
import { cn } from '@/lib/utils';

export function EditableServiceName({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const rename = useRenameService(id);

  useEffect(() => setValue(name), [name]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (!next || next === name) {
      setValue(name);
      return;
    }
    rename.mutate(next, { onError: () => setValue(name) });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Service name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setValue(name);
            setEditing(false);
          }
        }}
        className="border-primary focus-visible:ring-ring/40 w-full max-w-sm rounded-sm border-b bg-transparent text-2xl font-semibold tracking-tight outline-none focus-visible:ring-[3px]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      aria-label={`Rename ${name}`}
      className={cn(
        'group focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-sm text-2xl font-semibold tracking-tight outline-none focus-visible:ring-[3px]',
        rename.isPending && 'opacity-60',
      )}
    >
      {name}
      <Pencil className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
    </button>
  );
}
