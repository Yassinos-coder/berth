import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class MoveServiceDto {
  @IsString()
  @MinLength(1)
  serverId!: string;

  @IsOptional()
  @IsBoolean()
  confirmDataLoss?: boolean;
}
