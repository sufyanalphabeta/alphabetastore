import { initSentry } from './config/sentry';

// Must be the very first import so Sentry instruments all other modules
initSentry(process.env.SENTRY_DSN);

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const uploadsPath = join(process.cwd(), 'uploads');

  app.setGlobalPrefix(configService.get<string>('API_PREFIX', 'api/v1'), {
    exclude: ['health'],
  });
  // Product images and branding assets are served statically.
  // Private uploads (payment receipts, etc.) are exposed via authenticated
  // controllers — do NOT add additional static prefixes here.
  app.useStaticAssets(join(uploadsPath, 'products'), {
    prefix: '/uploads/products/',
  });
  app.useStaticAssets(join(uploadsPath, 'branding'), {
    prefix: '/uploads/branding/',
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SuccessResponseInterceptor());

  const rawOrigins = configService.get<string>('CORS_ALLOWED_ORIGINS', '');
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isDevelopment = configService.get<string>('NODE_ENV') !== 'production';
  const corsOrigins =
    allowedOrigins.length
      ? allowedOrigins
      : isDevelopment
        ? ['http://localhost:3000']
        : false;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  if (isDevelopment) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Alphabeta Store API')
      .setDescription('REST API for the Alphabeta Store platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
}

bootstrap();