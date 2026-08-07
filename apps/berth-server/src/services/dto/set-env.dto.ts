import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class EnvVarInput {
  @IsString()
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

export class SetEnvDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvVarInput)
  env!: EnvVarInput[];
}
