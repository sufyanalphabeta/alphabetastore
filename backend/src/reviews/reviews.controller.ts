import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../prisma/prisma-client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsQueryDto, ModerateReviewDto } from './dto/find-reviews-query.dto';
import { ReviewsService } from './reviews.service';

type AuthRequest = { user: JwtPayload };

const imageUploadInterceptor = FilesInterceptor('images', 5, {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Public: list APPROVED reviews for a product. */
  @Get()
  findAll(@Param('productId') productId: string, @Query() query: FindReviewsQueryDto) {
    return this.reviewsService.findProductReviews(productId, query);
  }

  /** Public: rating summary (avg, distribution, total). */
  @Get('summary')
  summary(@Param('productId') productId: string) {
    return this.reviewsService.getRatingSummary(productId);
  }

  /** Authenticated: get my own review for this product. */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  getMyReview(@Param('productId') productId: string, @Req() req: AuthRequest) {
    return this.reviewsService.getMyReview(productId, req.user.sub);
  }

  /** Authenticated: submit a new review (with optional image uploads). */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUploadInterceptor)
  create(
    @Param('productId') productId: string,
    @Req() req: AuthRequest,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const imageBuffers = (files ?? []).map(f => ({ buffer: f.buffer, originalname: f.originalname }));
    return this.reviewsService.create(productId, req.user.sub, dto, imageBuffers);
  }

  /** Authenticated: edit own review. */
  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(imageUploadInterceptor)
  update(
    @Param('reviewId') reviewId: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const imageBuffers = (files ?? []).map(f => ({ buffer: f.buffer, originalname: f.originalname }));
    return this.reviewsService.update(reviewId, req.user.sub, dto, imageBuffers);
  }

  /** Authenticated: delete own review. */
  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('reviewId') reviewId: string, @Req() req: AuthRequest) {
    return this.reviewsService.remove(reviewId, req.user.sub);
  }
}

// ── Admin review moderation ──────────────────────────────────────────────────

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Admin: list all reviews with optional status filter. */
  @Get()
  findAll(@Query() query: FindReviewsQueryDto) {
    return this.reviewsService.adminFindAll(query);
  }

  /** Admin: approve / reject / hide a review. */
  @Patch(':reviewId/moderate')
  moderate(@Param('reviewId') reviewId: string, @Body() dto: ModerateReviewDto) {
    return this.reviewsService.moderate(reviewId, dto);
  }
}
