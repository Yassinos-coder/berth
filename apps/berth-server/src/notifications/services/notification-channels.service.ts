import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannelRepository } from '../repositories/notification-channel.repository';
import { NotificationChannelMapper } from '../mappers/notification-channel.mapper';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { CreateNotificationChannelDto } from '../dto/create-notification-channel.dto';
import type { NotificationChannelDto } from '../interfaces';

@Injectable()
export class NotificationChannelsService {
  constructor(
    private readonly repository: NotificationChannelRepository,
    private readonly secretCipher: SecretCipher,
  ) {}

  async list(orgId: string): Promise<NotificationChannelDto[]> {
    const channels = await this.repository.listByOrg(orgId);
    return channels.map(NotificationChannelMapper.toDto);
  }

  async create(
    orgId: string,
    dto: CreateNotificationChannelDto,
  ): Promise<NotificationChannelDto> {
    this.assertValid(dto);
    const channel = await this.repository.create({
      orgId,
      name: dto.name,
      kind: dto.kind,
      webhookUrl: dto.webhookUrl,
      webhookSecret: dto.webhookSecret,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUser: dto.smtpUser,
      smtpPasswordEncrypted: dto.smtpPassword
        ? this.secretCipher.encrypt(dto.smtpPassword)
        : undefined,
      emailFrom: dto.emailFrom,
      emailTo: dto.emailTo,
    });
    return NotificationChannelMapper.toDto(channel);
  }

  async setEnabled(
    orgId: string,
    id: string,
    enabled: boolean,
  ): Promise<void> {
    const updated = await this.repository.setEnabled(orgId, id, enabled);
    if (!updated) throw new NotFoundException('Notification channel not found');
  }

  async remove(orgId: string, id: string): Promise<void> {
    const deleted = await this.repository.delete(orgId, id);
    if (!deleted) throw new NotFoundException('Notification channel not found');
  }

  private assertValid(dto: CreateNotificationChannelDto): void {
    if (
      (dto.kind === 'slack' || dto.kind === 'discord' || dto.kind === 'webhook') &&
      !dto.webhookUrl
    ) {
      throw new BadRequestException(`A webhook URL is required for ${dto.kind} channels`);
    }
    if (dto.kind === 'email' && (!dto.smtpHost || !dto.smtpPort || !dto.emailTo)) {
      throw new BadRequestException(
        'SMTP host, port, and a recipient address are required for email channels',
      );
    }
  }
}
