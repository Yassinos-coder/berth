import { IsInt, Max, Min } from 'class-validator';

export class UpdateServerStorageDto {
  @IsInt()
  @Min(5)
  @Max(65536)
  storageBudgetGb!: number;
}
