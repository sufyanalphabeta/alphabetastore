import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import {
  NOTIFICATION_JOBS,
  QUEUE_NAMES,
  type OrderPlacedJobData,
  type OrderStatusChangedJobData,
  type PasswordResetJobData,
  type PaymentJobData,
} from './queue.constants';

/**
 * NotificationService enqueues background jobs for email/push notifications.
 *
 * The BullMQ queue is optional – if Redis is not configured the service
 * falls back to a no-op so the rest of the application continues to work
 * without a queue.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue | null,
  ) {}

  async notifyOrderPlaced(data: OrderPlacedJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.ORDER_PLACED, data);
  }

  async notifyOrderStatusChanged(data: OrderStatusChangedJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.ORDER_STATUS_CHANGED, data);
  }

  async notifyPaymentReceived(data: PaymentJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.PAYMENT_RECEIVED, data);
  }

  async notifyPaymentApproved(data: PaymentJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.PAYMENT_APPROVED, data);
  }

  async notifyPaymentRejected(data: PaymentJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.PAYMENT_REJECTED, data);
  }

  async notifyPasswordReset(data: PasswordResetJobData): Promise<void> {
    await this.enqueue(NOTIFICATION_JOBS.PASSWORD_RESET, data);
  }

  private async enqueue(jobName: string, data: unknown): Promise<void> {
    if (!this.notificationsQueue) {
      this.logger.debug(`Queue not available – skipping job: ${jobName}`);
      return;
    }

    try {
      await this.notificationsQueue.add(jobName, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue job "${jobName}": ${error}`);
    }
  }
}
