import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  controllers: [AttributesController],
  providers: [AttributesService, RolesGuard],
  exports: [AttributesService],
})
export class AttributesModule {}
