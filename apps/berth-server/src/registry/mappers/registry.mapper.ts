import { matchDatabaseTemplate } from '../../common/database/database-catalog';
import type { RegistryImageDto, RegistryTagDto } from '../interfaces';

export interface HubSearchResult {
  repo_name: string;
  short_description?: string;
  star_count?: number;
  is_official?: boolean;
  pull_count?: number;
}

export interface HubTagResult {
  name: string;
  full_size?: number;
  last_updated?: string;
}

export class RegistryMapper {
  static toImage(result: HubSearchResult): RegistryImageDto {
    return {
      name: result.repo_name,
      description: result.short_description ?? '',
      official: Boolean(result.is_official),
      stars: result.star_count ?? 0,
      pulls: result.pull_count ?? 0,
      templateKind: matchDatabaseTemplate(result.repo_name)?.kind,
    };
  }

  static toTag(result: HubTagResult): RegistryTagDto {
    return {
      name: result.name,
      sizeMb: result.full_size
        ? Math.round(result.full_size / 1_000_000)
        : undefined,
      lastUpdated: result.last_updated,
    };
  }
}
