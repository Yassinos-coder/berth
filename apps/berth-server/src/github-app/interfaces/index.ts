export interface GithubRepoDto {
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export interface GithubBranchDto {
  name: string;
}
