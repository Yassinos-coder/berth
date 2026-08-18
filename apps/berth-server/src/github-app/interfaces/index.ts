export interface GithubRepoDto {
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export interface GithubBranchDto {
  name: string;
}

export interface GithubStatusDto {
  configured: boolean;
  connected: boolean;
  accountLogin?: string;
}

export interface GithubManifestDto {
  url: string;
  manifest: Record<string, unknown>;
}

export interface GithubTreeDto {
  directories: string[];
  dockerfiles: string[];
  monorepoMarkers: string[];
}
