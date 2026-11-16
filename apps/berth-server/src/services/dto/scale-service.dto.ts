import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { ReplicaPolicyDto } from './replica-policy.dto';

export class ScaleServiceDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  replicas?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReplicaPolicyDto)
  replicaPolicy?: ReplicaPolicyDto;
}
