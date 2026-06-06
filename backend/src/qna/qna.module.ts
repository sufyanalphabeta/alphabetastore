import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminQnaController, QnaController } from './qna.controller';
import { QnaService } from './qna.service';

@Module({
  imports: [PrismaModule],
  controllers: [QnaController, AdminQnaController],
  providers: [QnaService, RolesGuard],
})
export class QnaModule {}
