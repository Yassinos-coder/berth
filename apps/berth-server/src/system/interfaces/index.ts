export interface SystemVersionDto {
  version: string;
  commit: string;
  latestCommit: string | null;
  updateAvailable: boolean;
  branch: string;
}
