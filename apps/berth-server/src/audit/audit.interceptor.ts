import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithUser } from '../common/interfaces';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & Partial<RequestWithUser>>();
    return next.handle().pipe(tap({ next: () => {
      if (!MUTATIONS.has(request.method) || !request.user) return;
      const resource = request.originalUrl.split('?')[0].replace(/^\/api\//, '');
      void this.prisma.auditEvent.create({ data: { orgId: request.user.orgId, actorId: request.user.id, action: request.method.toLowerCase(), resource, ip: request.ip ?? '', userAgent: request.headers['user-agent'] ?? '', metadata: { status: context.switchToHttp().getResponse<{ statusCode: number }>().statusCode } } }).catch(() => undefined);
    } }));
  }
}
