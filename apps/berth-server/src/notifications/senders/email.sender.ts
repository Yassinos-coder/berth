import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { NotificationChannel } from '@prisma/client';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import type { NotificationEvent } from '../interfaces';

@Injectable()
export class EmailSender {
  constructor(private readonly secretCipher: SecretCipher) {}

  async send(
    channel: NotificationChannel,
    event: NotificationEvent,
  ): Promise<void> {
    if (!channel.smtpHost || !channel.smtpPort || !channel.emailTo) {
      throw new Error('Email channel is missing SMTP configuration');
    }

    const transport = createTransport({
      host: channel.smtpHost,
      port: channel.smtpPort,
      secure: channel.smtpSecure ?? channel.smtpPort === 465,
      auth: channel.smtpUser
        ? {
            user: channel.smtpUser,
            pass: channel.smtpPasswordEncrypted
              ? this.secretCipher.decrypt(channel.smtpPasswordEncrypted)
              : undefined,
          }
        : undefined,
    });

    await transport.sendMail({
      from: channel.emailFrom || channel.smtpUser || undefined,
      to: channel.emailTo,
      subject: `[Berth] ${event.title}`,
      text: event.detail,
    });
  }
}
