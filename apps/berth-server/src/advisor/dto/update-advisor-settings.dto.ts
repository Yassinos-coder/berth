import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAdvisorSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  monthlyCapUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  priceInPerMTok?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  priceOutPerMTok?: number;
}
