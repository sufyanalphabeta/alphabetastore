import { Module } from '@nestjs/common';
import { CatalogImportController } from './catalog-import.controller';
import { CatalogImportService } from './catalog-import.service';
import { ValidationMatchingService } from './matching';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { AttributesModule } from '../attributes/attributes.module';

@Module({ imports: [CategoriesModule, ProductsModule, AttributesModule], controllers: [CatalogImportController], providers: [CatalogImportService, ValidationMatchingService] })
export class CatalogImportModule {}
