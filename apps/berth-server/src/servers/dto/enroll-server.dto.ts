import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class EnrollServerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(65536)
  storageBudgetGb?: number;
}
