import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Alphabeta Store',
  site_logo_url: '',
  theme: 'default',
  primary_color: '#1976d2',
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
  terms_and_conditions_text:
    'باستخدامك لمنصة Alphabeta Store وتسجيل حساب جديد، فإنك توافق على صحة البيانات المدخلة والالتزام بسياسات المتجر وإتمام الطلبات بطريقة نظامية.',
  privacy_policy_text:
    'تقوم منصة Alphabeta Store بجمع بياناتك الأساسية فقط لغرض تقديم الخدمة ومعالجة الطلبات والدفع والدعم، ولا يتم مشاركة بياناتك خارج نطاق التشغيل القانوني للخدمة.',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: {
        key: 'asc',
      },
    });

    const result: Record<string, string> = {};

    for (const setting of settings as Array<{ key: string; value: string }>) {
      result[setting.key] = setting.value;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...result,
    };
  }

  async findGrouped() {
    const settings = await this.findAll();

    return {
      general: {
        site_name: settings.site_name,
        site_logo_url: settings.site_logo_url ?? '',
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

    return {
      key: updated.key,
      value: updated.value,
    };
  }
}
