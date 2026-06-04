import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import {
  CreateHomepageBlockDto,
  UpdateHomepageBlockDto,
} from './dto/homepage-block.dto';
import { HomepageService } from './homepage.service';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  /** Public storefront — fully hydrated active blocks. */
  @Get('layout')
  layout() {
    return this.homepageService.getLayout();
  }

  /** Admin — list all blocks (raw rows, including inactive). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('blocks')
  list() {
    return this.homepageService.findAllAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('blocks')
  create(@Body() dto: CreateHomepageBlockDto) {
    return this.homepageService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('blocks/reorder')
  reorder(@Body() body: { items: Array<{ id: string; sortOrder: number }> }) {
    return this.homepageService.reorder(body?.items ?? []);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('blocks/:id')
  update(@Param('id') id: string, @Body() dto: UpdateHomepageBlockDto) {
    return this.homepageService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('blocks/:id')
  remove(@Param('id') id: string) {
    return this.homepageService.remove(id);
  }
}
