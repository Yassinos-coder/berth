import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AgentStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../repositories/user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import type { JwtPayload } from '../../common/interfaces';
import type { AuthUserDto, SessionDto, SetupStateDto } from '../interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async setupState(): Promise<SetupStateDto> {
    const count = await this.users.count();
    return { needsSetup: count === 0 };
  }

  async getUser(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Session user not found');
    return UserMapper.toAuthUser(user);
  }

  async register(dto: RegisterDto): Promise<SessionDto> {
    const existing = await this.users.count();
    if (existing > 0) {
      throw new BadRequestException('Setup already completed — sign in instead');
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.createOwnerWithOrg({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      orgName: `${dto.name.split(' ')[0]}'s Organization`,
    });
    await this.provisionLocalServer(user.orgId);
    return this.buildSession(user);
  }

  private async provisionLocalServer(orgId: string): Promise<void> {
    const token = this.configService.get<string>('localBootstrapToken');
    if (!token) return;

    const hostname =
      process.env.BERTH_LOCAL_HOSTNAME ?? process.env.HOSTNAME ?? 'local-server';
    await this.prisma.server.create({
      data: {
        orgId,
        name: hostname,
        region: 'Local',
        isLocal: true,
        status: AgentStatus.enrolling,
        bootstrapToken: token,
        bootstrapExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async login(dto: LoginDto): Promise<SessionDto> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.users.touchLastActive(user.id);
    return this.buildSession(user);
  }

  githubAuthorizeUrl(): { url: string } {
    const clientId = this.configService.get<string>('github.clientId');
    if (!clientId) return { url: '#' };
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'repo,read:user',
    });
    return { url: `https://github.com/login/oauth/authorize?${params}` };
  }

  private async buildSession(user: User): Promise<SessionDto> {
    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    };
    const token = await this.jwtService.signAsync(payload);
    return { user: UserMapper.toAuthUser(user), token };
  }
}
