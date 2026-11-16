import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ReplicaPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  minReplicas?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  maxReplicas?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  targetCpuPct?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  targetMemoryPct?: number;

  @IsOptional()
  @IsIn(['manual', 'cpu', 'memory', 'balanced'])
  strategy?: 'manual' | 'cpu' | 'memory' | 'balanced';

  @IsOptional()
  @IsInt()
  @Min(30)
  cooldownSeconds?: number;
}
