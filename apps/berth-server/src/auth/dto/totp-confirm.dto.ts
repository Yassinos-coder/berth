import { IsString, Length } from 'class-validator';

export class TotpConfirmDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
