import { Session } from '@prisma/client';
import type { ActiveSessionDto } from '../interfaces';

export class SessionMapper {
  static toDto(session: Session, currentId: string | undefined): ActiveSessionDto {
    return {
      id: session.id,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      current: session.id === currentId,
    };
  }
}
