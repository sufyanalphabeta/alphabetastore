import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type SkuDatabase = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ProductSkuService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(explicitSku?: string | null, database: SkuDatabase = this.prisma): Promise<string> {
    const customSku = explicitSku?.trim();
    if (customSku) return customSku;

    while (true) {
      const [row] = await database.$queryRaw<Array<{ value: bigint }>>(
        Prisma.sql`SELECT nextval('product_sku_seq')::bigint AS value`,
      );
      if (!row) throw new Error('Product SKU sequence did not return a value.');

      const candidate = `AB-${row.value.toString().padStart(6, '0')}`;
      const existing = await database.product.findUnique({ where: { sku: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
  }
}
