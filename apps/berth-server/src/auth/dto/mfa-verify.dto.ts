import { IsOptional, IsString } from 'class-validator';

export class MfaVerifyDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  recoveryCode?: string;
}
