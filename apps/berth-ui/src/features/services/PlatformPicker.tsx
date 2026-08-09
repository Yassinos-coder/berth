import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';

export function PlatformPicker({ serviceId, value }: { serviceId: string; value?: 'linux/amd64' | 'linux/arm64' }) {
  const [platform, setPlatform] = useState(value ?? 'linux/amd64'); const update = useUpdateServiceSettings(serviceId);
  return <Card><CardHeader><CardTitle className="text-base">Target architecture</CardTitle></CardHeader><CardContent className="flex items-center gap-3"><Select value={platform} onValueChange={(next) => setPlatform(next as typeof platform)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="linux/amd64">Linux x86-64</SelectItem><SelectItem value="linux/arm64">Linux ARM64</SelectItem></SelectContent></Select><Button size="sm" onClick={() => update.mutate({ targetPlatform: platform })}>Save</Button></CardContent></Card>;
}
