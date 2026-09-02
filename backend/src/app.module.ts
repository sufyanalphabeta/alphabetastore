import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { MailerModule } from './common/mailer/mailer.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { validationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { HomepageModule } from './homepage/homepage.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { QueueModule } from './queue/queue.module';
import { ServicesModule } from './services/services.module';
import { SettingsModule } from './settings/settings.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewsModule } from './reviews/reviews.module';
import { QnaModule } from './qna/qna.module';
import { VariantsModule } from './variants/variants.module';
import { BundlesModule } from './bundles/bundles.module';
import { ProductRelationsModule } from './product-relations/product-relations.module';
import { CatalogImportModule } from './catalog-import/catalog-import.module';
import { MediaModule } from './media/media.module';
import { AttributesModule } from './attributes/attributes.module';
import { ActivityPresetsModule } from './activity-presets/activity-presets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get<string>('NODE_ENV') !== 'production';

        return {
          pinoHttp: {
            level: isDevelopment ? 'debug' : 'info',
            transport: isDevelopment
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            genReqId: (req: any) => {
              const headerId = req?.headers?.['x-request-id'];
              if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
              if (typeof req?.id === 'string' && req.id) return req.id;
              return randomUUID();
            },
            customLogLevel: (_req: unknown, res: { statusCode: number }, err: unknown) => {
              if (err || (res?.statusCode ?? 0) >= 500) {
                return 'error';
              }

              if ((res?.statusCode ?? 0) >= 400) {
                return 'warn';
              }

              return 'info';
            },
          },
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          const { default: KeyvRedis } = await import('@keyv/redis');
          const { default: Keyv } = await import('keyv');

          return {
            stores: [
              new Keyv({
                store: new KeyvRedis(redisUrl),
                ttl: 60_000,
              }),
            ],
          };
        }

        return { ttl: 60_000 };
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    MailerModule,
    UsersModule,
    AuthModule,
    DashboardModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    HomepageModule,
    ServicesModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    PricingModule,
    SettingsModule,
    TicketsModule,
    WishlistModule,
    ReviewsModule,
    QnaModule,
    VariantsModule,
    BundlesModule,
    ProductRelationsModule,
    CatalogImportModule,
    MediaModule,
    AttributesModule,
    ActivityPresetsModule,
    QueueModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
