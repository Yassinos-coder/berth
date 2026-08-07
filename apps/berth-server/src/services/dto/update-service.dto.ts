import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateServiceDto {
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
}
