import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  cpuPct?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  memPct?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(99)
  diskPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  minutes?: number;
}
