import { IsString, Matches } from 'class-validator';

const DOMAIN_OR_EMPTY = /^(?:|(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;

export class UpdatePanelDomainDto {
  @IsString()
  @Matches(DOMAIN_OR_EMPTY, {
    message: 'Enter a valid domain, e.g. berth.example.com',
  })
  domain!: string;
}
