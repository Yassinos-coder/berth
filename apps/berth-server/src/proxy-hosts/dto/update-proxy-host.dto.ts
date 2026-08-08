import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export class UpdateProxyHostDto {
  @IsOptional()
  @IsString()
  @Matches(DOMAIN, { message: 'Enter a valid domain, e.g. app.example.com' })
  domain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  targetPort?: number;

  @IsOptional()
  @IsBoolean()
  ssl?: boolean;

  @IsOptional()
  @IsBoolean()
  forceHttps?: boolean;
}
