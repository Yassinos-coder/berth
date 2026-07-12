import { useEffect, useState } from 'react';
import { BadgeCheck, Database, Loader2, Search, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useImageSearch, useImageTags } from '@/hooks/useRegistryQueries';
import { cn } from '@/lib/utils';
import type { RegistryImage } from '@/interfaces';

interface ImageSearchProps {
  dbOnly?: boolean;
  onSelect: (image: RegistryImage | null, tag: string) => void;
}

export function ImageSearch({ dbOnly = false, onSelect }: ImageSearchProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<RegistryImage | null>(null);
  const [tag, setTag] = useState('latest');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const search = useImageSearch(debounced);
  const tags = useImageTags(selected?.name);

  const results = (search.data ?? []).filter(
    (r) => !dbOnly || Boolean(r.templateKind),
  );

  useEffect(() => {
    if (selected) onSelect(selected, tag);
  }, [selected, tag, onSelect]);

  const pick = (image: RegistryImage) => {
    setSelected(image);
    setTag('latest');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder={
            dbOnly ? 'Search databases — redis, postgres…' : 'Search Docker Hub…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {search.isFetching ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      {debounced.length >= 2 && results.length > 0 ? (
        <div className="border-border max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {results.map((image) => (
            <button
              key={image.name}
              type="button"
              onClick={() => pick(image)}
              className={cn(
                'hover:bg-muted flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors',
                selected?.name === image.name && 'bg-muted',
              )}
            >
              <span className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                {image.templateKind ? (
                  <Database className="size-4" />
                ) : (
                  <Search className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">
                    {image.name}
                  </span>
                  {image.official ? (
                    <BadgeCheck className="text-primary size-4 shrink-0" />
                  ) : null}
                  {image.templateKind ? (
                    <Badge variant="secondary" className="text-[10px]">
                      database
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {image.description || 'No description'}
                </p>
              </div>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                <Star className="size-3" />
                {image.stars.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="border-border bg-muted/40 flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">
              {selected.name}:{tag}
            </p>
            <p className="text-muted-foreground text-xs">Selected image</p>
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-muted-foreground text-[11px]">Tag</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(tags.data ?? [{ name: 'latest' }]).map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
