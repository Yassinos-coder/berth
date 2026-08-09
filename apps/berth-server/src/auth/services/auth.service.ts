import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { AgentStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { OpaqueTokenGenerator } from '../../common/utils/opaque-token.util';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { InviteTokenRepository } from '../repositories/invite-token.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { UserMapper } from '../mappers/user.mapper';
import { SessionMapper } from '../mappers/session.mapper';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { MfaVerifyDto } from '../dto/mfa-verify.dto';
import { RecoveryCodeGenerator } from '../utils/recovery-code.util';
import type { JwtPayload, MfaChallengePayload } from '../../common/interfaces';
import type {
  ActiveSessionDto,
  AuthUserDto,
  InvitePreviewDto,
  LoginOutcome,
  RecoveryCodesDto,
  SessionContext,
  SessionDto,
  SetupStateDto,
  TotpSetupDto,
  TotpStatusDto,
} from '../interfaces';

const MFA_CHALLENGE_TTL = '5m';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly inviteTokens: InviteTokenRepository,
    private readonly passwordResetTokens: PasswordResetTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly secretCipher: SecretCipher,
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

  async register(dto: RegisterDto, context: SessionContext): Promise<SessionDto> {
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
    return this.buildSession(user, context);
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

  async login(dto: LoginDto, context: SessionContext): Promise<LoginOutcome> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.users.touchLastActive(user.id);

    if (user.totpEnabled) {
      const mfaToken = await this.signMfaChallenge(user.id);
      return { mfaRequired: true, mfaToken };
    }

    return { mfaRequired: false, session: await this.buildSession(user, context) };
  }

  async verifyMfaChallenge(
    mfaToken: string,
    dto: MfaVerifyDto,
    context: SessionContext,
  ): Promise<SessionDto> {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<MfaChallengePayload>(
        mfaToken,
        { secret: this.configService.get<string>('jwtSecret') },
      );
    } catch {
      throw new UnauthorizedException('MFA challenge expired, log in again');
    }
    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException('Invalid MFA challenge');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }

    if (dto.recoveryCode) {
      await this.consumeRecoveryCode(user, dto.recoveryCode);
    } else if (dto.code) {
      const secret = this.secretCipher.decrypt(user.totpSecret);
      if (!authenticator.check(dto.code, secret)) {
        throw new UnauthorizedException('Invalid verification code');
      }
    } else {
      throw new BadRequestException(
        'Provide a verification code or recovery code',
      );
    }

    await this.users.touchLastActive(user.id);
    return this.buildSession(user, context);
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(sessionToken, {
        secret: this.configService.get<string>('jwtSecret'),
      });
      if (payload.sid) await this.sessions.delete(payload.sub, payload.sid);
    } catch {
      /* token already invalid or expired — nothing to revoke */
    }
  }

  currentSessionId(sessionToken: string | undefined): string | undefined {
    if (!sessionToken) return undefined;
    const payload = this.jwtService.decode(sessionToken) as JwtPayload | null;
    return payload?.sid;
  }

  async listSessions(
    userId: string,
    currentId: string | undefined,
  ): Promise<ActiveSessionDto[]> {
    const sessions = await this.sessions.listForUser(userId);
    return sessions.map((s) => SessionMapper.toDto(s, currentId));
  }

  async revokeSession(userId: string, id: string): Promise<void> {
    const deleted = await this.sessions.delete(userId, id);
    if (!deleted) throw new NotFoundException('Session not found');
  }

  revokeOtherSessions(userId: string, currentId: string): Promise<number> {
    return this.sessions.deleteAllExcept(userId, currentId);
  }

  async previewInvite(token: string): Promise<InvitePreviewDto> {
    const record = await this.inviteTokens.findValidByHash(
      OpaqueTokenGenerator.hash(token),
    );
    if (!record) throw new NotFoundException('Invite link is invalid or expired');
    return { email: record.user.email, name: record.user.name };
  }

  async acceptInvite(
    token: string,
    password: string,
    context: SessionContext,
  ): Promise<SessionDto> {
    const record = await this.inviteTokens.findValidByHash(
      OpaqueTokenGenerator.hash(token),
    );
    if (!record) {
      throw new BadRequestException('Invite link is invalid or expired');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.users.setPasswordAndActivate(
      record.userId,
      passwordHash,
    );
    await this.inviteTokens.delete(record.userId);
    return this.buildSession(user, context);
  }

  async createInvite(userId: string): Promise<string> {
    const { token, tokenHash } = OpaqueTokenGenerator.generate();
    await this.inviteTokens.replace(
      userId,
      tokenHash,
      new Date(Date.now() + INVITE_TTL_MS),
    );
    return token;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) return;

    const { token, tokenHash } = OpaqueTokenGenerator.generate();
    await this.passwordResetTokens.replace(
      user.id,
      tokenHash,
      new Date(Date.now() + RESET_TTL_MS),
    );

    this.logger.log(
      `Password reset requested for ${user.email} — no mailer is configured, ` +
        `so share this link with them directly: /reset-password?token=${token}`,
    );
  }

  async previewResetToken(token: string): Promise<{ email: string }> {
    const record = await this.passwordResetTokens.findValidByHash(
      OpaqueTokenGenerator.hash(token),
    );
    if (!record) throw new NotFoundException('Reset link is invalid or expired');
    return { email: record.user.email };
  }

  async resetPassword(
    token: string,
    password: string,
    context: SessionContext,
  ): Promise<SessionDto> {
    const record = await this.passwordResetTokens.findValidByHash(
      OpaqueTokenGenerator.hash(token),
    );
    if (!record) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.users.updatePassword(record.userId, passwordHash);
    await this.passwordResetTokens.deleteForUser(record.userId);
    await this.sessions.deleteAll(record.userId);
    return this.buildSession(user, context);
  }

  async totpStatus(userId: string): Promise<TotpStatusDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Session user not found');
    return { enabled: user.totpEnabled };
  }

  async setupTotp(userId: string): Promise<TotpSetupDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Session user not found');
    if (user.totpEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled — disable it first to reconfigure',
      );
    }

    const secret = authenticator.generateSecret();
    await this.users.setTotpSecret(userId, this.secretCipher.encrypt(secret));

    const otpauthUrl = authenticator.keyuri(user.email, 'Berth', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl };
  }

  async confirmTotp(userId: string, code: string): Promise<RecoveryCodesDto> {
    const user = await this.users.findById(userId);
    if (!user?.totpSecret) {
      throw new BadRequestException('Start two-factor setup first');
    }
    if (user.totpEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    const secret = this.secretCipher.decrypt(user.totpSecret);
    if (!authenticator.check(code, secret)) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = RecoveryCodeGenerator.generate();
    const hashes = await Promise.all(
      recoveryCodes.map((c) => argon2.hash(c)),
    );
    await this.users.enableTotp(userId, hashes);
    return { recoveryCodes };
  }

  async disableTotp(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Session user not found');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    await this.users.disableTotp(userId);
  }

  async regenerateRecoveryCodes(
    userId: string,
    password: string,
  ): Promise<RecoveryCodesDto> {
    const user = await this.users.findById(userId);
    if (!user?.totpEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is not enabled',
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    const recoveryCodes = RecoveryCodeGenerator.generate();
    const hashes = await Promise.all(
      recoveryCodes.map((c) => argon2.hash(c)),
    );
    await this.users.setRecoveryCodeHashes(userId, hashes);
    return { recoveryCodes };
  }

  private async consumeRecoveryCode(
    user: User,
    plainCode: string,
  ): Promise<void> {
    const hashes = user.recoveryCodeHashes;
    for (let i = 0; i < hashes.length; i += 1) {
      if (await argon2.verify(hashes[i], plainCode)) {
        const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
        await this.users.setRecoveryCodeHashes(user.id, remaining);
        return;
      }
    }
    throw new UnauthorizedException('Invalid recovery code');
  }

  private async signMfaChallenge(userId: string): Promise<string> {
    const payload: MfaChallengePayload = { sub: userId, type: 'mfa_challenge' };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwtSecret'),
      expiresIn: MFA_CHALLENGE_TTL,
    });
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

  private async buildSession(
    user: User,
    context: SessionContext,
  ): Promise<SessionDto> {
    const session = await this.sessions.create({
      orgId: user.orgId,
      userId: user.id,
      userAgent: context.userAgent,
      ip: context.ip,
    });
    const payload: JwtPayload = {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      type: 'session',
      sid: session.id,
    };
    const token = await this.jwtService.signAsync(payload);
    return { user: UserMapper.toAuthUser(user), token };
  }
}
