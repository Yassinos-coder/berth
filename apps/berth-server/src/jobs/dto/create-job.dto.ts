import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobDto {
  @IsString() @MaxLength(80) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(64) @IsString({ each: true }) command!: string[];
  @IsString() @MaxLength(100) cron!: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
