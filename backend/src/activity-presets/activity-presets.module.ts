import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ActivityPresetsController } from './activity-presets.controller';
import { ActivityPresetsService } from './activity-presets.service';

@Module({ imports: [PrismaModule], controllers: [ActivityPresetsController], providers: [ActivityPresetsService] })
export class ActivityPresetsModule {}
