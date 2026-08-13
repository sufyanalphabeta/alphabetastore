import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MediaProcessingService } from './media-processing.service';
import { ProductMediaService } from './product-media.service';
import { MediaLibraryController } from './media-library.controller';
import { MediaLibraryService } from './media-library.service';
import { ProductMediaController } from './product-media.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [PrismaModule, ProductsModule, StorageModule],
  controllers: [MediaLibraryController, ProductMediaController],
  providers: [MediaProcessingService, ProductMediaService, MediaLibraryService],
  exports: [MediaProcessingService, ProductMediaService, MediaLibraryService],
})
export class MediaModule {}
