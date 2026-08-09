import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class RunCommandDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(64) @IsString({ each: true }) command!: string[];
}
