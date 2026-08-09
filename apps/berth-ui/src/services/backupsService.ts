import { ApiError } from '@/services/baseApiClient';
import type { Backup } from '@/interfaces';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Berth-Client': 'web',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    let message = body || res.statusText;
    try {
      const parsed = JSON.parse(body) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
      else if (parsed.message) message = parsed.message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

class BackupsService {
  list(serviceId: string): Promise<Backup[]> {
    return request<Backup[]>(`/services/${serviceId}/backups`);
  }

  create(serviceId: string, backupTargetId: string): Promise<Backup> {
    return request<Backup>(`/services/${serviceId}/backups`, {
      method: 'POST',
      body: JSON.stringify({ backupTargetId }),
    });
  }

  restore(serviceId: string, backupId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(
      `/services/${serviceId}/backups/${backupId}/restore`,
      { method: 'POST' },
    );
  }
}

export const backupsService = new BackupsService();
