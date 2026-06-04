import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendMailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Minimal mail abstraction used by notification processors.
 *
 * In production: configure SMTP_* env vars and the processor will deliver mail
 * via nodemailer. When SMTP is not configured the service logs the message at
 * `info` level so the queue still completes successfully and notifications
 * are observable in Pino/Sentry.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: { sendMail: (opts: unknown) => Promise<unknown> } | null = null;
  private transporterReady = false;

  constructor(private readonly config: ConfigService) {}

  async send(params: SendMailParams): Promise<void> {
    const transporter = await this.getTransporter();

    if (!transporter) {
      this.logger.log(
        `[mailer:noop] to=${params.to} subject="${params.subject}" body="${params.text.slice(0, 120)}"`,
      );
      return;
    }

    const from = this.config.get<string>('MAIL_FROM') ?? 'no-reply@alphabeta.local';

    try {
      await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      this.logger.log(`[mailer:sent] to=${params.to} subject="${params.subject}"`);
    } catch (error) {
      this.logger.error(`[mailer:failed] to=${params.to} subject="${params.subject}" err=${error}`);
      throw error;
    }
  }

  private async getTransporter() {
    if (this.transporterReady) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.transporterReady = true;
      return null;
    }

    try {
      const nm = await import('nodemailer' as string).catch(() => null);
      if (!nm) {
        this.logger.warn('SMTP_HOST is set but `nodemailer` is not installed; mail will be logged only.');
        this.transporterReady = true;
        return null;
      }

      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const secure = this.config.get<string>('SMTP_SECURE') === 'true';
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASSWORD');

      const createTransport = (nm as unknown as {
        createTransport: (opts: unknown) => { sendMail: (opts: unknown) => Promise<unknown> };
      }).createTransport;
      this.transporter = createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    } catch (error) {
      this.logger.warn(`Failed to initialize SMTP transporter: ${error}. Mail will be logged only.`);
      this.transporter = null;
    }

    this.transporterReady = true;
    return this.transporter;
  }
}
