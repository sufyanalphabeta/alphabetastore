import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_NAMES } from './queue.constants';
import { NotificationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';

/**
 * QueueModule registers BullMQ queues.
 *
 * When no REDIS_URL is present the connection is configured with
 * `enableOfflineQueue: false` and `lazyConnect: true` so BullMQ does not
 * block application startup.  NotificationService degrades gracefully to a
 * no-op when jobs cannot be enqueued.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        return {
          connection: redisUrl
            ? { url: redisUrl }
            : {
                host: 'localhost',
                port: 6379,
                lazyConnect: true,
                enableOfflineQueue: false,
                maxRetriesPerRequest: 0,
              },
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  providers: [NotificationService, NotificationProcessor],
  exports: [NotificationService],
})
export class QueueModule {}
