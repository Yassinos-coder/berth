import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  EnvText,
  type EnvFormat,
  type EnvTextError,
} from '@/features/services/envText';
import type { EnvVar } from '@berth/protocol';

const FORMATS: { value: EnvFormat; label: string }[] = [
  { value: 'dotenv', label: '.env' },
  { value: 'json', label: 'JSON' },
];

export function EnvRawEditor({
  rows,
  onApply,
  onCancel,
}: {
  rows: EnvVar[];
  onApply: (vars: EnvVar[]) => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<EnvFormat>('dotenv');
  const [showSecrets, setShowSecrets] = useState(false);
  const [text, setText] = useState(() => EnvText.serialize(rows, 'dotenv', false));
  const [errors, setErrors] = useState<EnvTextError[]>([]);

  const reformat = (nextFormat: EnvFormat, nextShowSecrets: boolean) => {
    const parsed = EnvText.parse(text, format, rows);
    if (parsed.errors.length > 0) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    setFormat(nextFormat);
    setShowSecrets(nextShowSecrets);
    setText(EnvText.serialize(parsed.vars, nextFormat, nextShowSecrets));
  };

  const apply = () => {
    const parsed = EnvText.parse(text, format, rows);
    setErrors(parsed.errors);
    if (parsed.errors.length === 0) onApply(parsed.vars);
  };

  return (
    <div className="space-y-3" data-testid="env-raw-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Text format" className="bg-muted inline-flex rounded-md p-0.5">
          {FORMATS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={format === option.value}
              onClick={() => format !== option.value && reformat(option.value, showSecrets)}
              className={cn(
                'rounded px-3 py-1 font-mono text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                format === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch
            checked={showSecrets}
            onCheckedChange={(next) => reformat(format, next)}
            aria-label="Show secret values"
          />
          Show secret values
        </label>
      </div>

      <textarea
        aria-label="Variables as text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={14}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        aria-invalid={errors.length > 0}
        className="border-input bg-background focus-visible:ring-ring/40 min-h-[320px] w-full resize-y rounded-md border p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px]"
      />

      {errors.length > 0 ? (
        <ul role="alert" className="border-destructive/40 bg-destructive/10 text-destructive space-y-1 rounded-md border px-3 py-2 text-xs">
          {errors.map((error, index) => (
            <li key={index}>
              {error.line ? <span className="font-mono">Line {error.line}: </span> : null}
              {error.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          Secret values show as <span className="font-mono">********</span>. Leave
          that in place to keep the current value. Changes are applied to the
          list; use Save to keep them.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={apply}>
          Apply changes
        </Button>
      </div>
    </div>
  );
}
