import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddInternalDomainDto {
  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/, {
    message:
      'Domain must be a valid DNS-style name (lowercase letters, digits, hyphens, dots)',
  })
  domain?: string;
}
