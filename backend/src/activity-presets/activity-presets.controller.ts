import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { ActivityPresetsService } from './activity-presets.service';

@Controller('admin/activity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ActivityPresetsController {
  constructor(private readonly activityPresets: ActivityPresetsService) {}

  @Get('presets')
  list() { return [{ code: 'ELECTRONICS_COMPUTERS', nameAr: 'الإلكترونيات والكمبيوتر', nameEn: 'Electronics & Computers' }]; }

  @Get('preview')
  preview(@Query('code') code?: string) { return this.activityPresets.preview(code); }

  @Post('apply')
  apply(@Query('code') code?: string) { return this.activityPresets.apply(code); }
}
