import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';

import { JwtPayload } from '../auth/types/jwt-payload.type';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { StorageService } from '../storage/local-storage.service';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { PaymentsService } from './payments.service';

const MAX_RECEIPT_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.webp']);

type PaymentRequest = {
  user?: JwtPayload | null;
};

function paymentReceiptFileFilter(
  _request: unknown,
  file: { mimetype: string; originalname: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const extension = extname(file.originalname).toLowerCase();
  const isImage = file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';

  if ((!isImage && !isPdf) || !ALLOWED_RECEIPT_EXTENSIONS.has(extension)) {
    callback(
      new BadRequestException('Only PNG, JPG, JPEG, WEBP, and PDF receipt files are allowed.') as unknown as Error,
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly storageService: StorageService,
  ) {}

  @Get('payment-methods')
  findActiveMethods() {
    return this.paymentsService.findActiveMethods();
  }

  @Post('payments/orders/:orderId')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(OptionalJwtAuthGuard)
  createOrderPayment(
    @Req() request: PaymentRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('orderId') orderId: string,
    @Body() createOrderPaymentDto: CreateOrderPaymentDto,
  ) {
    return this.paymentsService.createOrderPayment(
      {
        userId: request.user?.sub ?? null,
        sessionId: sessionId ?? null,
      },
      orderId,
      createOrderPaymentDto,
    );
  }

  @Post('payments/:id/receipt')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: paymentReceiptFileFilter,
      limits: {
        fileSize: MAX_RECEIPT_FILE_SIZE,
      },
    }),
  )
  async uploadReceipt(
    @Req() request: PaymentRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Receipt file is required.');
    }

    const fileUrl = await this.storageService.saveFile(file.buffer, {
      subdirectory: 'payment-receipts',
      originalname: file.originalname,
    });

    return this.paymentsService.uploadReceipt(
      {
        userId: request.user?.sub ?? null,
        sessionId: sessionId ?? null,
      },
      id,
      fileUrl,
    );
  }

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAllAdminPayments() {
    return this.paymentsService.findAllAdminPayments();
  }

  @Patch('admin/payments/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reviewPayment(
    @Req() request: PaymentRequest,
    @Param('id') id: string,
    @Body() reviewPaymentDto: ReviewPaymentDto,
  ) {
    return this.paymentsService.reviewPayment(id, request.user!.sub, reviewPaymentDto);
  }

  @Get('payments/receipts/:id/file')
  @UseGuards(JwtAuthGuard)
  async streamReceipt(
    @Req() request: PaymentRequest,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const user = request.user!;
    const receipt = await this.paymentsService.getReceiptForUser(
      id,
      user.sub,
      user.role === Role.ADMIN,
    );

    const file = await this.storageService.readFile(receipt.fileUrl);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    );
    if (file.contentLength) {
      res.setHeader('Content-Length', String(file.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');

    file.stream.pipe(res);
  }
}