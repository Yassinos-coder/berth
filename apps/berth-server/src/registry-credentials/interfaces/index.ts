export interface RegistryCredentialDto {
  id: string;
  name: string;
  server: string;
  username: string;
  createdAt: string;
}

export interface ResolvedRegistryAuth {
  server: string;
  username: string;
  password: string;
}
