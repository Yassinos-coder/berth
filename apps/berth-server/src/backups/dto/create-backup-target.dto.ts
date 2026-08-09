import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBackupTargetDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  endpoint!: string;

  @IsString()
  @MinLength(1)
  bucket!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsString()
  @MinLength(1)
  accessKeyId!: string;

  @IsString()
  @MinLength(1)
  secretAccessKey!: string;
}
