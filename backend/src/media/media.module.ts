import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MediaProcessingService } from './media-processing.service';
import { ProductMediaService } from './product-media.service';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [MediaProcessingService, ProductMediaService],
  exports: [MediaProcessingService, ProductMediaService],
})
export class MediaModule {}
