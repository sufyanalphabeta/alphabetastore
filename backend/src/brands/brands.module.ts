import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [StorageModule],
  controllers: [BrandsController],
  providers: [BrandsService, RolesGuard],
  exports: [BrandsService],
})
export class BrandsModule {}
