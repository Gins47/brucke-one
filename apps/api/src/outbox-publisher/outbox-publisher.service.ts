import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { outboxEvents } from '../database/schema';
import { BullMqHelpRequestEventsQueue } from './help-request-events.queue';

const publishIntervalMilliseconds = 5000;
const pendingBatchSize = 20;
const queueFailureMessage = 'Queue publication failed';
const redisUrlPattern = /rediss?:\/\/[^\s'"`]+/gi;
const maximumLoggedErrorLength = 300;

/** Converts a queue error into a bounded message without Redis credentials. */
function getSafeQueueErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return 'Unknown queue error';
  }

  const message = error.message.replace(redisUrlPattern, '<redis-url>');

  return message.slice(0, maximumLoggedErrorLength);
}

/** Publishes committed outbox events after their PostgreSQL transaction has finished. */
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private interval: NodeJS.Timeout | undefined;
  private isPublishing = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly queue: BullMqHelpRequestEventsQueue,
  ) {}

  /** Starts local-development polling for the configured Redis queue. */
  onModuleInit(): void {
    this.interval = setInterval(() => {
      void this.runScheduledPublish();
    }, publishIntervalMilliseconds);
    this.interval.unref();
  }

  /** Stops the local polling timer when the Nest application shuts down. */
  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  /** Publishes one bounded pending batch without overlapping work in this process. */
  async publishPendingEvents(): Promise<number> {
    if (this.isPublishing) {
      return 0;
    }

    this.isPublishing = true;
    try {
      const events = await this.database.db
        .select({
          id: outboxEvents.id,
          helpRequestId: outboxEvents.helpRequestId,
        })
        .from(outboxEvents)
        .where(
          and(
            isNull(outboxEvents.enqueuedAt),
            eq(outboxEvents.eventType, 'help-request-submitted'),
          ),
        )
        .orderBy(asc(outboxEvents.createdAt), asc(outboxEvents.id))
        .limit(pendingBatchSize);
      let publishedCount = 0;

      for (const event of events) {
        try {
          await this.queue.enqueue({
            outboxEventId: event.id,
            helpRequestId: event.helpRequestId,
          });
          await this.database.db
            .update(outboxEvents)
            .set({ enqueuedAt: new Date(), lastError: null })
            .where(
              and(
                eq(outboxEvents.id, event.id),
                isNull(outboxEvents.enqueuedAt),
              ),
            );
          publishedCount += 1;
        } catch (error) {
          await this.database.db
            .update(outboxEvents)
            .set({
              attemptCount: sql`${outboxEvents.attemptCount} + 1`,
              lastError: queueFailureMessage,
            })
            .where(
              and(
                eq(outboxEvents.id, event.id),
                isNull(outboxEvents.enqueuedAt),
              ),
            );
          this.logger.warn(
            `Outbox event ${event.id} was not published and will be retried: ${getSafeQueueErrorMessage(error)}`,
          );
        }
      }

      return publishedCount;
    } finally {
      this.isPublishing = false;
    }
  }

  /** Contains scheduled publication failures so the timer can retry on its next run. */
  private async runScheduledPublish(): Promise<void> {
    try {
      await this.publishPendingEvents();
    } catch {
      this.logger.error('Outbox publication run failed');
    }
  }
}
