import { Module } from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { BundlesController, AdminBundlesController } from './bundles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [BundlesController, AdminBundlesController],
  providers: [BundlesService, RolesGuard],
  exports: [BundlesService],
})
export class BundlesModule {}
