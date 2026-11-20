import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsEnum,
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
import { ServiceKind } from '@prisma/client';
import { ReplicaPolicyDto } from './replica-policy.dto';

class BuildConfigDto {
  @IsIn(['auto', 'nixpacks', 'dockerfile'])
  builder!: 'auto' | 'nixpacks' | 'dockerfile';

  @IsOptional()
  @IsString()
  dockerfilePath?: string;

  @IsOptional()
  @IsString()
  rootDirectory?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;
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

class EnvVarDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
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

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsBoolean()
  publicNetworking?: boolean;

  @IsOptional()
  @IsInt()
  containerPort?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  command?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2048)
  diskGb?: number;

  @IsOptional()
  @IsString()
  volumePath?: string;

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
  @IsIn(['rolling', 'recreate'])
  deployStrategy?: 'rolling' | 'recreate';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7200)
  stopGracePeriodSeconds?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EnvVarDto)
  env?: EnvVarDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceSourceDto)
  source?: ServiceSourceDto;

  @ValidateNested()
  @Type(() => ResourceLimitsDto)
  resources!: ResourceLimitsDto;
}
