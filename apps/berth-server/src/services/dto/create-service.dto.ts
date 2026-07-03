import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ServiceKind } from '@prisma/client';

class BuildConfigDto {
  @IsIn(['auto', 'nixpacks', 'dockerfile'])
  builder!: 'auto' | 'nixpacks' | 'dockerfile';

  @IsOptional()
  @IsString()
  dockerfilePath?: string;

  @IsOptional()
  @IsString()
  rootDirectory?: string;
}

class ServiceSourceDto {
  @IsIn(['git', 'image'])
  kind!: 'git' | 'image';

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  repo?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BuildConfigDto)
  build?: BuildConfigDto;
}

class ResourceLimitsDto {
  @IsNumber()
  cpuCores!: number;

  @IsInt()
  memoryMb!: number;

  @IsOptional()
  @IsInt()
  cpuShares?: number;

  @IsOptional()
  @IsInt()
  pidsLimit?: number;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ServiceKind)
  kind!: ServiceKind;

  @IsString()
  serverId!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @ValidateNested()
  @Type(() => ServiceSourceDto)
  source!: ServiceSourceDto;

  @ValidateNested()
  @Type(() => ResourceLimitsDto)
  resources!: ResourceLimitsDto;
}
