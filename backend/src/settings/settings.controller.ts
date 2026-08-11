import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { StorageService } from '../storage/local-storage.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { SettingsService } from './settings.service';

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp']);

function logoFileFilter(_req: Express.Request, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_IMAGE_EXTS.has(ext)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only png, jpg, jpeg, svg, webp files are allowed'), false);
  }
}

@Controller()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly storageService: StorageService,
  ) {}

  @Get('settings')
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('settings/grouped')
  findGrouped() {
    return this.settingsService.findGrouped();
  }

  @Patch('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateSetting(@Body() updateSystemSettingDto: UpdateSystemSettingDto) {
    return this.settingsService.updateSetting(updateSystemSettingDto);
  }

  @Post('admin/settings/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: logoFileFilter,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const url = await this.storageService.saveFile(file.buffer, {
      subdirectory: 'branding',
      originalname: file.originalname,
    });
    await this.settingsService.updateSetting({ key: 'site_logo_url', value: url });
    return { url };
  }

  @Post('admin/settings/favicon')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: logoFileFilter,
      limits: { fileSize: 512 * 1024 }, // 512 KB
    }),
  )
  async uploadFavicon(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const url = await this.storageService.saveFile(file.buffer, {
      subdirectory: 'branding',
      originalname: file.originalname,
    });
    await this.settingsService.updateSetting({ key: 'site_favicon_url', value: url });
    return { url };
  }
}
