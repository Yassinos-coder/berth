import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImportComposeDto {
  @IsString() serverId!: string;
  @IsString() @MinLength(2) @MaxLength(500_000) document!: string;
}
