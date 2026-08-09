import { IsString, MinLength } from 'class-validator';

export class TotpDisableDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
