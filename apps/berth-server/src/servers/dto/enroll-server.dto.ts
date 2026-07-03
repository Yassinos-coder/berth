import { IsString, MaxLength, MinLength } from 'class-validator';

export class EnrollServerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  name!: string;
}
