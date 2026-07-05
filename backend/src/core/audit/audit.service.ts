import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only audit trail (cross-cutting; the runtime DB role can only
 * SELECT/INSERT on audit_logs). Recording must never break the business
 * operation it accompanies — failures are logged, not propagated.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata ?? {},
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit event ${entry.action} for ${entry.entityType}/${entry.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
