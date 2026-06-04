import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { MailerService } from '../common/mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_JOBS,
  OrderPlacedJobData,
  OrderStatusChangedJobData,
  PasswordResetJobData,
  PaymentJobData,
  QUEUE_NAMES,
} from './queue.constants';

/**
 * Background notification dispatcher.
 *
 * Each handler loads the entities involved from the database and produces
 * a structured log line plus, when SMTP is configured, an email via
 * `MailerService`. Handlers are intentionally idempotent so that BullMQ's
 * retry mechanism is safe.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.ORDER_PLACED:
        return this.handleOrderPlaced(job as Job<OrderPlacedJobData>);
      case NOTIFICATION_JOBS.ORDER_STATUS_CHANGED:
        return this.handleOrderStatusChanged(job as Job<OrderStatusChangedJobData>);
      case NOTIFICATION_JOBS.PAYMENT_RECEIVED:
        return this.handlePaymentEvent(job as Job<PaymentJobData>, 'received');
      case NOTIFICATION_JOBS.PAYMENT_APPROVED:
        return this.handlePaymentEvent(job as Job<PaymentJobData>, 'approved');
      case NOTIFICATION_JOBS.PAYMENT_REJECTED:
        return this.handlePaymentEvent(job as Job<PaymentJobData>, 'rejected');
      case NOTIFICATION_JOBS.PASSWORD_RESET:
        return this.handlePasswordReset(job as Job<PasswordResetJobData>);
      default:
        this.logger.warn(`Unknown notification job: ${job.name}`);
    }
  }

  private async handleOrderPlaced(job: Job<OrderPlacedJobData>): Promise<void> {
    const { orderId } = job.data;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        fullName: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!order) {
      this.logger.warn(`order.placed: order ${orderId} not found`);
      return;
    }

    this.logger.log(
      `[order.placed] order=${order.orderNumber ?? order.id} total=${order.totalAmount} user=${order.user?.email ?? 'guest'}`,
    );

    if (order.user?.email) {
      await this.mailer.send({
        to: order.user.email,
        subject: `Alphabeta Store — تأكيد الطلب ${order.orderNumber ?? order.id}`,
        text:
          `مرحبًا ${order.user.name ?? order.fullName},\n\n` +
          `تم استلام طلبك ${order.orderNumber ?? order.id} بإجمالي ${order.totalAmount}.` +
          ` سنقوم بإعلامك عند تحديث حالة الطلب.`,
      });
    }
  }

  private async handleOrderStatusChanged(
    job: Job<OrderStatusChangedJobData>,
  ): Promise<void> {
    const { orderId, status } = job.data;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        user: { select: { email: true, name: true } },
        fullName: true,
      },
    });

    if (!order) {
      this.logger.warn(`order.status_changed: order ${orderId} not found`);
      return;
    }

    this.logger.log(
      `[order.status_changed] order=${order.orderNumber ?? order.id} status=${status}`,
    );

    if (order.user?.email) {
      await this.mailer.send({
        to: order.user.email,
        subject: `Alphabeta Store — تحديث حالة الطلب ${order.orderNumber ?? order.id}`,
        text:
          `مرحبًا ${order.user.name ?? order.fullName},\n\n` +
          `أصبحت حالة طلبك ${order.orderNumber ?? order.id} الآن: ${status}.`,
      });
    }
  }

  private async handlePaymentEvent(
    job: Job<PaymentJobData>,
    eventLabel: 'received' | 'approved' | 'rejected',
  ): Promise<void> {
    const { paymentId, orderId } = job.data;
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        status: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            fullName: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!payment) {
      this.logger.warn(`payment.${eventLabel}: payment ${paymentId} not found (order=${orderId})`);
      return;
    }

    this.logger.log(
      `[payment.${eventLabel}] payment=${payment.id} order=${payment.order.orderNumber ?? payment.order.id} amount=${payment.amount} status=${payment.status}`,
    );

    const recipient = payment.order.user?.email;
    if (!recipient) return;

    const subject =
      eventLabel === 'received'
        ? 'تم استلام إيصال الدفع'
        : eventLabel === 'approved'
          ? 'تم قبول الدفعة'
          : 'تم رفض الدفعة';

    await this.mailer.send({
      to: recipient,
      subject: `Alphabeta Store — ${subject} — ${payment.order.orderNumber ?? payment.order.id}`,
      text:
        `مرحبًا ${payment.order.user?.name ?? payment.order.fullName},\n\n` +
        `${subject} الخاصة بطلبك ${payment.order.orderNumber ?? payment.order.id} بمبلغ ${payment.amount}.`,
    });
  }

  private async handlePasswordReset(job: Job<PasswordResetJobData>): Promise<void> {
    const { email, resetUrl } = job.data;
    this.logger.log(`[auth.password_reset] dispatch to=${email}`);

    await this.mailer.send({
      to: email,
      subject: 'Alphabeta Store — إعادة تعيين كلمة المرور',
      text:
        `لإعادة تعيين كلمة المرور (الرابط صالح لـ 30 دقيقة):\n${resetUrl}\n\n` +
        `إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد.`,
      html: `<p>لإعادة تعيين كلمة المرور (الرابط صالح لـ 30 دقيقة):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}
