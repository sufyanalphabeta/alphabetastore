import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto, AnswerQuestionDto } from './dto/qna.dto';

const QNA_SELECT = {
  id: true,
  productId: true,
  userId: true,
  question: true,
  answer: true,
  answeredAt: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
};

@Injectable()
export class QnaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: list ANSWERED questions for a product. */
  async findProductQnA(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where = { productId, status: 'ANSWERED' as const };

    const [items, total] = await Promise.all([
      this.prisma.productQnA.findMany({
        where,
        select: QNA_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productQnA.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Customer: ask a question. */
  async ask(productId: string, userId: string, dto: CreateQuestionDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');

    return this.prisma.productQnA.create({
      data: { productId, userId, question: dto.question, status: 'PENDING' },
      select: QNA_SELECT,
    });
  }

  /** Customer: delete own question (unanswered only). */
  async removeQuestion(questionId: string, userId: string) {
    const item = await this.prisma.productQnA.findUnique({
      where: { id: questionId },
      select: { id: true, userId: true, status: true },
    });
    if (!item) throw new NotFoundException('Question not found.');
    if (item.userId !== userId) throw new ForbiddenException('You can only delete your own question.');
    if (item.status === 'ANSWERED') throw new ForbiddenException('Cannot delete an answered question.');

    await this.prisma.productQnA.delete({ where: { id: questionId } });
    return { message: 'Question deleted.' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Admin: list all questions, optionally filtered by status. */
  async adminFindAll(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [items, total] = await Promise.all([
      this.prisma.productQnA.findMany({
        where,
        select: {
          ...QNA_SELECT,
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productQnA.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Admin: answer a question. */
  async answer(questionId: string, dto: AnswerQuestionDto) {
    const item = await this.prisma.productQnA.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Question not found.');

    return this.prisma.productQnA.update({
      where: { id: questionId },
      data: {
        answer: dto.answer,
        answeredAt: new Date(),
        status: 'ANSWERED',
      },
      select: QNA_SELECT,
    });
  }

  /** Admin: hide a question. */
  async hide(questionId: string) {
    const item = await this.prisma.productQnA.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Question not found.');

    return this.prisma.productQnA.update({
      where: { id: questionId },
      data: { status: 'HIDDEN' },
      select: { id: true, status: true },
    });
  }
}
