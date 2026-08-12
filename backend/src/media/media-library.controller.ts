import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { MediaLibraryService } from './media-library.service';
import { MediaListQueryDto } from './dto/media-list-query.dto';
import { UpdateMediaMetadataDto } from './dto/update-media-metadata.dto';

type AuthenticatedRequest = Request & { user: { sub: string } };

@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MediaLibraryController {
  constructor(private readonly mediaLibraryService: MediaLibraryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('A JPG, PNG, or WebP image is required.');
    return this.mediaLibraryService.upload(file, request.user.sub);
  }

  @Get()
  list(@Query() query: MediaListQueryDto) {
    return this.mediaLibraryService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaLibraryService.findOne(id);
  }

  @Patch(':id')
  updateMetadata(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaMetadataDto) {
    return this.mediaLibraryService.updateMetadata(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaLibraryService.remove(id);
  }
}
