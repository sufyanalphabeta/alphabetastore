import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AttributeDataType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ELECTRONICS_COMPUTERS_PRESET } from './electronics-computers.preset';

const PRESETS = { ELECTRONICS_COMPUTERS: ELECTRONICS_COMPUTERS_PRESET } as const;

type Classification = 'CREATE' | 'REUSE' | 'LINK' | 'UPDATE_SAFE' | 'CONFLICT' | 'SKIP';
type PreviewItem = { kind: string; key: string; label: string; classification: Classification; reason?: string };

@Injectable()
export class ActivityPresetsService {
  constructor(private readonly prisma: PrismaService, @Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  getPreset(code = 'ELECTRONICS_COMPUTERS') {
    const preset = PRESETS[code as keyof typeof PRESETS];
    if (!preset) throw new ConflictException(`Unknown activity preset: ${code}`);
    return preset;
  }

  async preview(code = 'ELECTRONICS_COMPUTERS') {
    const preset = this.getPreset(code);
    const attributes = preset.attributes as readonly import('./electronics-computers.preset').PresetAttribute[];
    const [definitions, profiles, categories] = await Promise.all([
      this.prisma.attributeDefinition.findMany(),
      this.prisma.attributeProfile.findMany({ include: { items: true } }),
      this.prisma.category.findMany({ select: { id: true, slug: true, name: true, attributeProfileId: true } }),
    ]);
    const items: PreviewItem[] = [];
    const definitionByCode = new Map(definitions.map(item => [item.code, item]));
    const profileByName = new Map(profiles.map(item => [item.name, item]));
    const categoryBySlug = new Map(categories.map(item => [item.slug, item]));
    const categoriesMatched: Array<{ slug: string; id: string; name: string }> = [];
    const categoriesUnmatched: string[] = [];

    for (const profile of preset.profiles) {
      const existingProfile = profileByName.get(profile.name);
      const matched = profile.categorySlugs.map(slug => categoryBySlug.get(slug)).filter(Boolean) as typeof categories;
      for (const slug of profile.categorySlugs) {
        const category = categoryBySlug.get(slug);
        if (category) categoriesMatched.push({ slug, id: category.id, name: category.name });
        else categoriesUnmatched.push(slug);
      }
      items.push({ kind: 'profile', key: profile.key, label: profile.name, classification: existingProfile ? 'REUSE' : 'CREATE' });
      if (existingProfile) {
        for (const category of matched) if (!category.attributeProfileId) items.push({ kind: 'category-link', key: category.slug, label: category.name, classification: 'LINK' });
        else if (category.attributeProfileId !== existingProfile.id) items.push({ kind: 'category-link', key: category.slug, label: category.name, classification: 'CONFLICT', reason: 'الفئة مرتبطة يدويًا بملف آخر.' });
      } else {
        for (const category of matched) items.push({ kind: 'category-link', key: category.slug, label: category.name, classification: category.attributeProfileId ? 'CONFLICT' : 'LINK', reason: category.attributeProfileId ? 'الفئة مرتبطة يدويًا بملف آخر.' : undefined });
      }
    }
    for (const attribute of attributes) {
      items.push({ kind: 'attribute', key: attribute.code, label: attribute.nameAr, classification: definitionByCode.has(attribute.code) ? 'REUSE' : 'CREATE' });
    }
    const counts = (classification: Classification) => items.filter(item => item.classification === classification).length;
    return {
      preset: { code: preset.code, nameAr: preset.nameAr, nameEn: preset.nameEn, version: preset.version },
      categoriesMatched,
      categoriesUnmatched: [...new Set(categoriesUnmatched)],
      items,
      summary: {
        attributesToCreate: counts('CREATE') - preset.profiles.filter(profile => !profileByName.has(profile.name)).length,
        attributesToReuse: attributes.filter(attribute => definitionByCode.has(attribute.code)).length,
        profilesToCreate: preset.profiles.filter(profile => !profileByName.has(profile.name)).length,
        profilesToReuse: preset.profiles.filter(profile => profileByName.has(profile.name)).length,
        linksToCreate: counts('LINK'),
        conflicts: counts('CONFLICT'),
        skips: counts('SKIP'),
      },
    };
  }

  async apply(code = 'ELECTRONICS_COMPUTERS') {
    const preset = this.getPreset(code);
    const attributes = preset.attributes as readonly import('./electronics-computers.preset').PresetAttribute[];
    const result = await this.prisma.$transaction(async tx => {
      const definitions = new Map((await tx.attributeDefinition.findMany()).map(item => [item.code, item]));
      const definitionIds = new Map<string, string>();
      let createdDefinitions = 0;
      let reusedDefinitions = 0;
      for (const attribute of attributes) {
        const existing = definitions.get(attribute.code);
        if (existing) { definitionIds.set(attribute.code, existing.id); reusedDefinitions++; continue; }
        const created = await tx.attributeDefinition.create({ data: {
          code: attribute.code,
          nameAr: attribute.nameAr,
          nameEn: attribute.nameEn,
          dataType: attribute.dataType as AttributeDataType,
          unit: attribute.unit,
          allowedValues: attribute.allowedValues ? attribute.allowedValues : Prisma.JsonNull,
        }});
        definitionIds.set(attribute.code, created.id); createdDefinitions++;
      }
      const categories = new Map((await tx.category.findMany({ where: { slug: { in: preset.profiles.flatMap(profile => profile.categorySlugs) } } })).map(item => [item.slug, item]));
      const profiles = new Map((await tx.attributeProfile.findMany({ include: { items: true } })).map(item => [item.name, item]));
      let createdProfiles = 0;
      let reusedProfiles = 0;
      let createdLinks = 0;
      const conflicts: string[] = [];
      const unmatched: string[] = [];
      for (const profileSpec of preset.profiles) {
        let profile = profiles.get(profileSpec.name);
        if (profile) reusedProfiles++;
        else {
          profile = await tx.attributeProfile.create({ data: { name: profileSpec.name, description: `Preset: ${preset.nameEn}`, items: { create: profileSpec.attributes.map((item, index) => ({ attributeDefinitionId: definitionIds.get(item.code)!, required: item.required, filterable: item.filterable, comparable: item.comparable, visibleOnProduct: item.visibleOnProduct, visibleInSummary: item.visibleInSummary, sortOrder: index })) } }, include: { items: true } });
          profiles.set(profile.name, profile); createdProfiles++;
        }
        for (const slug of profileSpec.categorySlugs) {
          const category = categories.get(slug);
          if (!category) { unmatched.push(slug); continue; }
          if (!category.attributeProfileId) { await tx.category.update({ where: { id: category.id }, data: { attributeProfileId: profile.id } }); createdLinks++; }
          else if (category.attributeProfileId !== profile.id) conflicts.push(slug);
        }
      }
      await tx.systemSetting.upsert({ where: { key: 'activity_preset_code' }, update: { value: preset.code }, create: { key: 'activity_preset_code', value: preset.code } });
      return { preset: preset.code, createdDefinitions, reusedDefinitions, createdProfiles, reusedProfiles, createdLinks, unmatched: [...new Set(unmatched)], conflicts: [...new Set(conflicts)] };
    });
    await this.cacheManager.clear();
    return result;
  }
}
