import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  RegistryMapper,
  type HubSearchResult,
  type HubTagResult,
} from '../mappers/registry.mapper';
import type { RegistryImageDto, RegistryTagDto } from '../interfaces';

const HUB = 'https://hub.docker.com/v2';
const TIMEOUT_MS = 6000;

@Injectable()
export class RegistryService {
  async search(query: string): Promise<RegistryImageDto[]> {
    const url = `${HUB}/search/repositories/?query=${encodeURIComponent(
      query,
    )}&page_size=25`;
    const data = await this.fetchJson<{ results: HubSearchResult[] }>(url);
    return data.results.map(RegistryMapper.toImage);
  }

  async tags(image: string): Promise<RegistryTagDto[]> {
    const repo = image.includes('/') ? image : `library/${image}`;
    const url = `${HUB}/repositories/${repo}/tags?page_size=50&ordering=last_updated`;
    const data = await this.fetchJson<{ results: HubTagResult[] }>(url);
    return data.results.map(RegistryMapper.toTag);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new BadGatewayException(`Docker Hub responded ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Could not reach Docker Hub');
    } finally {
      clearTimeout(timer);
    }
  }
}
