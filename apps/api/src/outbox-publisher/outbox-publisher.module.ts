import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import {
  BullMqHelpRequestEventsQueue,
  HELP_REQUEST_EVENTS_QUEUE_NAME,
} from './help-request-events.queue';
import { getRedisConfig } from './outbox-publisher.config';
import { OutboxPublisherService } from './outbox-publisher.service';

const redisConfig = getRedisConfig();

/** Registers the Redis-backed outbox publisher and its BullMQ queue. */
@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      connection: {
        url: redisConfig.url,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      },
    }),
    BullModule.registerQueue({ name: HELP_REQUEST_EVENTS_QUEUE_NAME }),
  ],
  providers: [OutboxPublisherService, BullMqHelpRequestEventsQueue],
})
export class OutboxPublisherModule {}
