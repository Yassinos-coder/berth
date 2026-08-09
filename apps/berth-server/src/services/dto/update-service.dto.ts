import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  rootDirectory?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;

  @IsOptional()
  @IsString()
  dockerfilePath?: string;

  @IsOptional()
  @IsIn(['auto', 'nixpacks', 'dockerfile'])
  builder?: 'auto' | 'nixpacks' | 'dockerfile';

  @IsOptional()
  @IsString()
  registryCredentialId?: string;

  @IsOptional()
  @IsIn(['linux/amd64', 'linux/arm64'])
  targetPlatform?: 'linux/amd64' | 'linux/arm64';
}
