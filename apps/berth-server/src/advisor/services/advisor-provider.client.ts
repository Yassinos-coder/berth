import { Injectable } from '@nestjs/common';
import type { AdvisorWireFormat } from '@berth/protocol';

export interface CompletionRequest {
  wire: AdvisorWireFormat;
  baseUrl: string;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export class AdvisorProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The provider rejected the request. Check the model name.',
  401: 'The provider rejected the API key.',
  403: 'The API key does not have access to that model.',
  404: 'The provider could not find that model or URL.',
  408: 'The provider timed out.',
  429: 'The provider is rate limiting requests or the account is out of credit.',
};

@Injectable()
export class AdvisorProviderClient {
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    return request.wire === 'anthropic'
      ? this.anthropic(request)
      : this.openai(request);
  }

  private async anthropic(request: CompletionRequest): Promise<CompletionResult> {
    const body = await this.send(`${request.baseUrl}/v1/messages`, request, {
      headers: {
        'x-api-key': request.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      },
    });
    const parts = Array.isArray(body.content) ? (body.content as { type?: string; text?: string }[]) : [];
    const text = parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('');
    const usage = (body.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
    return { text, tokensIn: usage.input_tokens ?? 0, tokensOut: usage.output_tokens ?? 0 };
  }

  private async openai(request: CompletionRequest): Promise<CompletionResult> {
    const headers: Record<string, string> = request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {};
    const messages = [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ];
    const url = `${request.baseUrl}/chat/completions`;
    let body: Record<string, unknown>;
    try {
      body = await this.send(url, request, { headers, body: { model: request.model, messages, max_tokens: request.maxTokens } });
    } catch (error) {
      if (!(error instanceof AdvisorProviderError) || error.status !== 400) throw error;
      body = await this.send(url, request, { headers, body: { model: request.model, messages, max_completion_tokens: request.maxTokens } });
    }
    const choices = Array.isArray(body.choices) ? (body.choices as { message?: { content?: string } }[]) : [];
    const usage = (body.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
    return {
      text: choices[0]?.message?.content ?? '',
      tokensIn: usage.prompt_tokens ?? 0,
      tokensOut: usage.completion_tokens ?? 0,
    };
  }

  private async send(
    url: string,
    request: CompletionRequest,
    options: { headers: Record<string, string>; body: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...options.headers },
        body: JSON.stringify(options.body),
        signal: AbortSignal.timeout(request.timeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new AdvisorProviderError(
        timedOut ? 'The provider took too long to answer.' : 'Could not reach the provider. Check the URL and your network.',
      );
    }

    if (!response.ok) {
      const message =
        STATUS_MESSAGES[response.status] ??
        (response.status >= 500 ? 'The provider had an internal error. Try again later.' : `The provider returned an error (${response.status}).`);
      throw new AdvisorProviderError(message, response.status);
    }
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new AdvisorProviderError('The provider sent a reply Berth could not read.');
    }
  }
}
