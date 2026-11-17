import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EnvText } from '@/features/services/envText';
import type { EnvVar } from '@berth/protocol';

export function EnvPasteDialog({ onImport }: { onImport: (vars: EnvVar[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const apply = () => {
    const parsed = EnvText.parse(text, 'dotenv', []).vars;
    onImport(parsed);
    setText('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="size-4" aria-hidden="true" /> Paste .env
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste a .env file</DialogTitle>
          <DialogDescription>
            One <code>KEY=value</code> per line. Existing keys are overwritten;
            new keys are added. Keys that look like secrets are marked secret
            automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dotenv-paste">Variables</Label>
          <textarea
            id="dotenv-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            placeholder={'DATABASE_URL=postgres://…\nSUPABASE_ANON_KEY=…'}
            className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-md border p-3 font-mono text-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!text.trim()}>
            Import Variables
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

