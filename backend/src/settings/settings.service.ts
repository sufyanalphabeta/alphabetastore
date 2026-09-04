import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

const SETTINGS_CACHE_KEY = 'settings:all';
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const VALID_THEME_KEYS = new Set(['BAZAAR_ELECTRONICS', 'BAZAAR_FASHION', 'BAZAAR_GROCERY', 'BAZAAR_HEALTH', 'BAZAAR_GIFT', 'BAZAAR_GENERAL', 'DEFAULT', 'TECH_MODERN', 'DARK_TECH', 'MINIMAL_LIGHT', 'default', 'electronics', 'dark', 'fashion', 'red', 'green', 'orange', 'gold', 'gift', 'paste', 'health', 'bluish', 'yellow']);

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Alphabeta Store',
  site_logo_url: '',
  site_favicon_url: '',
  theme: 'BAZAAR_ELECTRONICS',
  primary_color: '',
  enable_whatsapp: 'true',
  default_language: 'ar',
  direction: 'rtl',
  default_currency: 'LYD',
  exchange_rate_usd_to_lyd: '5.2',
  auto_round_prices: 'false',
  shop_phone: '+218000000000',
  shop_address: 'Tripoli, Libya',
  min_order: '0',
  support_email: 'support@alphabeta.com',
  footer_description: 'Alphabeta Store مدعوم بواجهات خلفية حقيقية.',
  footer_copyright: 'جميع الحقوق محفوظة.',
  app_store_url: '',
  google_play_url: '',
  terms_and_conditions_text:
    'باستخدامك لمنصة Alphabeta Store وتسجيل حساب جديد، فإنك توافق على صحة البيانات المدخلة والالتزام بسياسات المتجر وإتمام الطلبات بطريقة نظامية.',
  privacy_policy_text:
    'تقوم منصة Alphabeta Store بجمع بياناتك الأساسية فقط لغرض تقديم الخدمة ومعالجة الطلبات والدفع والدعم، ولا يتم مشاركة بياناتك خارج نطاق التشغيل القانوني للخدمة.',
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll() {
    const cached = await this.cache.get<Record<string, string>>(SETTINGS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const settings = await this.prisma.systemSetting.findMany({
      orderBy: {
        key: 'asc',
      },
    });

    const result: Record<string, string> = {};

    for (const setting of settings as Array<{ key: string; value: string }>) {
      result[setting.key] = setting.value;
    }

    const merged = {
      ...DEFAULT_SETTINGS,
      ...result,
    };

    await this.cache.set(SETTINGS_CACHE_KEY, merged, SETTINGS_CACHE_TTL_MS);
    return merged;
  }

  async findGrouped() {
    const settings = await this.findAll();

    return {
      general: {
        site_name: settings.site_name,
        site_logo_url: settings.site_logo_url ?? '',
        site_favicon_url: settings.site_favicon_url ?? '',
        theme: settings.theme,
        primary_color: settings.primary_color,
        enable_whatsapp: settings.enable_whatsapp,
        default_language: settings.default_language,
        direction: settings.direction,
        default_currency: settings.default_currency,
        exchange_rate_usd_to_lyd: settings.exchange_rate_usd_to_lyd,
        shop_phone: settings.shop_phone,
        shop_address: settings.shop_address,
        min_order: settings.min_order,
        support_email: settings.support_email,
        terms_and_conditions_text: settings.terms_and_conditions_text,
        privacy_policy_text: settings.privacy_policy_text,
      },
      all: settings,
    };
  }

  async updateSetting(updateSystemSettingDto: UpdateSystemSettingDto) {
    const { key, value } = updateSystemSettingDto;
    if (key === 'theme' && !VALID_THEME_KEYS.has(value.trim())) {
      throw new BadRequestException('Unsupported theme preset.');
    }

    const updated = await this.prisma.systemSetting.upsert({
      where: {
        key,
      },
      update: {
        value,
      },
      create: {
        key,
        value,
      },
    });

    await this.cache.del(SETTINGS_CACHE_KEY);
    await this.cache.del('pricing:settings');

    return {
      key: updated.key,
      value: updated.value,
    };
  }
}
