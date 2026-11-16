import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ReplicaPolicyDto } from './replica-policy.dto';

class UpdateResourceLimitsDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.01)
  cpuCores?: number;

  @IsOptional()
  @IsInt()
  @Min(16)
  memoryMb?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(262144)
  cpuShares?: number;
}

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

  @IsOptional()
  @IsBoolean()
  previewsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  alertsMuted?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  replicas?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReplicaPolicyDto)
  replicaPolicy?: ReplicaPolicyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateResourceLimitsDto)
  resources?: UpdateResourceLimitsDto;

  @IsOptional()
  @IsString()
  volumePath?: string;
}
