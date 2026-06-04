import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';

@Module({
  controllers: [HomepageController],
  providers: [HomepageService, RolesGuard],
  exports: [HomepageService],
})
export class HomepageModule {}
