import { IsEmail, IsIn } from 'class-validator';
import { Role } from '@prisma/client';

const ASSIGNABLE: Role[] = [Role.admin, Role.deployer, Role.viewer];

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(ASSIGNABLE)
  role!: Role;
}

export class UpdateRoleDto {
  @IsIn(ASSIGNABLE)
  role!: Role;
}
