import { IsString } from 'class-validator';

export class CreateBackupDto {
  @IsString()
  backupTargetId!: string;
}
