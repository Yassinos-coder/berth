import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNotificationChannelDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['slack', 'discord', 'webhook', 'email'])
  kind!: 'slack' | 'discord' | 'webhook' | 'email';

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  emailFrom?: string;

  @IsOptional()
  @IsString()
  emailTo?: string;
}
