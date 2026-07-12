export interface RegistryImageDto {
  name: string;
  description: string;
  official: boolean;
  stars: number;
  pulls: number;
  templateKind?: string;
}

export interface RegistryTagDto {
  name: string;
  sizeMb?: number;
  lastUpdated?: string;
}
