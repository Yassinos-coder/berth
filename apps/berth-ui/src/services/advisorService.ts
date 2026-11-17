import { BaseApiClient } from '@/services/baseApiClient';
import type {
  AdvisorFindingDto,
  AdvisorSettingsDto,
  AdvisorSummaryDto,
} from '@berth/protocol';

export interface AdvisorSettingsPayload {
  enabled?: boolean;
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  monthlyCapUsd?: number;
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
}

export interface AdvisorRunResult {
  ran: boolean;
  reason?: string;
  usedAi: boolean;
  findings: number;
  costUsd: number;
  notice?: string;
}

export interface AdvisorTestResult {
  ok: boolean;
  message: string;
  costUsd: number;
}

class AdvisorService extends BaseApiClient {
  protected resource = 'advisor';

  summary(): Promise<AdvisorSummaryDto> {
    return this.get<AdvisorSummaryDto>('/summary');
  }

  settings(): Promise<AdvisorSettingsDto> {
    return this.get<AdvisorSettingsDto>('/settings');
  }

  findings(view: 'open' | 'history'): Promise<AdvisorFindingDto[]> {
    return this.get<AdvisorFindingDto[]>(`/findings?view=${view}`);
  }

  updateSettings(payload: AdvisorSettingsPayload): Promise<AdvisorSettingsDto> {
    return this.put<AdvisorSettingsDto>('/settings', payload);
  }

  test(): Promise<AdvisorTestResult> {
    return this.post<AdvisorTestResult>('/test');
  }

  run(): Promise<AdvisorRunResult> {
    return this.post<AdvisorRunResult>('/run');
  }

  apply(id: string): Promise<AdvisorFindingDto> {
    return this.post<AdvisorFindingDto>(`/findings/${id}/apply`);
  }

  dismiss(id: string): Promise<AdvisorFindingDto> {
    return this.post<AdvisorFindingDto>(`/findings/${id}/dismiss`);
  }

  undo(id: string): Promise<AdvisorFindingDto> {
    return this.post<AdvisorFindingDto>(`/findings/${id}/undo`);
  }
}

export const advisorService = new AdvisorService();
