import { IsBoolean } from 'class-validator';

export class UpdateResourceSettingsDto {
  @IsBoolean()
  enabled!: boolean;
}
