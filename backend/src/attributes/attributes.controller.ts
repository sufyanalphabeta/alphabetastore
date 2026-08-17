import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../prisma/prisma-client';
import { AttributesService } from './attributes.service';
import {
  AssignCategoryProfileDto,
  CreateAttributeDefinitionDto,
  CreateAttributeProfileDto,
  ReplaceProductAttributesDto,
  UpdateAttributeDefinitionDto,
  UpdateAttributeProfileDto,
} from './dto/attribute.dto';

@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get('category/:slug/filters')
  publicFilters(@Param('slug') slug: string) {
    return this.attributes.publicFilterProfile(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/definitions')
  definitions(@Query('active') active?: string) {
    return this.attributes.listDefinitions(active !== 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/definitions')
  createDefinition(@Body() dto: CreateAttributeDefinitionDto) {
    return this.attributes.createDefinition(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/definitions/:id')
  updateDefinition(@Param('id') id: string, @Body() dto: UpdateAttributeDefinitionDto) {
    return this.attributes.updateDefinition(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/definitions/:id')
  removeDefinition(@Param('id') id: string) {
    return this.attributes.removeDefinition(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/profiles')
  profiles() {
    return this.attributes.listProfiles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/profiles')
  createProfile(@Body() dto: CreateAttributeProfileDto) {
    return this.attributes.createProfile(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/profiles/:id')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateAttributeProfileDto) {
    return this.attributes.updateProfile(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('admin/profiles/:id')
  removeProfile(@Param('id') id: string) {
    return this.attributes.removeProfile(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/categories/:id/profile')
  assignCategory(@Param('id') id: string, @Body() dto: AssignCategoryProfileDto) {
    return this.attributes.assignCategoryProfile(id, dto.attributeProfileId ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/categories/:id/effective-profile')
  effectiveProfile(@Param('id') id: string) {
    return this.attributes.resolveEffectiveProfile(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/products/:id')
  productAttributes(@Param('id') id: string) {
    return this.attributes.getAdminProductAttributes(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put('admin/products/:id')
  replaceProductAttributes(@Param('id') id: string, @Body() dto: ReplaceProductAttributesDto) {
    return this.attributes.getAdminProductAttributes(id).then((state) =>
      this.attributes.replaceProductValues(id, state.categoryId, dto.values),
    );
  }
}
