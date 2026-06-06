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
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../prisma/prisma-client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateQuestionDto, AnswerQuestionDto } from './dto/qna.dto';
import { QnaService } from './qna.service';

type AuthRequest = { user: JwtPayload };

/** Public + customer Q&A for a product. */
@Controller('products/:productId/qna')
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Get()
  findAll(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.qnaService.findProductQnA(
      productId,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 10,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  ask(@Param('productId') productId: string, @Req() req: AuthRequest, @Body() dto: CreateQuestionDto) {
    return this.qnaService.ask(productId, req.user.sub, dto);
  }

  @Delete(':questionId')
  @UseGuards(JwtAuthGuard)
  remove(@Param('questionId') questionId: string, @Req() req: AuthRequest) {
    return this.qnaService.removeQuestion(questionId, req.user.sub);
  }
}

/** Admin Q&A management. */
@Controller('admin/qna')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminQnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.qnaService.adminFindAll(
      status,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 20,
    );
  }

  @Patch(':questionId/answer')
  answer(@Param('questionId') questionId: string, @Body() dto: AnswerQuestionDto) {
    return this.qnaService.answer(questionId, dto);
  }

  @Patch(':questionId/hide')
  hide(@Param('questionId') questionId: string) {
    return this.qnaService.hide(questionId);
  }
}
