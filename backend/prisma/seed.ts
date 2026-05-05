import 'dotenv/config';

import * as bcrypt from 'bcrypt';

import { PaymentMethodCode, PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? 'Alphabeta Admin';
  const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

  if (!adminEmail || !adminPassword) {
    console.warn('[seed] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin user creation.');
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, bcryptSaltRounds);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
      create: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`[seed] Admin user upserted: ${adminEmail}`);
  }

  const paymentMethods = [
    {
      code: PaymentMethodCode.COD,
      name: 'Cash on Delivery',
    },
    {
      code: PaymentMethodCode.BANK_TRANSFER,
      name: 'Bank Transfer',
    },
  ];

  for (const paymentMethod of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: {
        code: paymentMethod.code,
      },
      update: {
        name: paymentMethod.name,
        isActive: true,
      },
      create: {
        code: paymentMethod.code,
        name: paymentMethod.name,
        isActive: true,
      },
    });
  }

  const systemSettingsDefaults = [
    { key: 'site_name', value: 'Alphabeta Store' },
    { key: 'theme', value: 'default' },
    { key: 'primary_color', value: '#1976d2' },
    { key: 'enable_whatsapp', value: 'true' },
    { key: 'default_language', value: 'ar' },
    { key: 'direction', value: 'rtl' },
    { key: 'default_currency', value: 'LYD' },
    { key: 'exchange_rate_usd_to_lyd', value: '5.2' },
    { key: 'shop_phone', value: '+218000000000' },
    { key: 'shop_address', value: 'Tripoli, Libya' },
    { key: 'min_order', value: '0' },
    { key: 'support_email', value: 'support@alphabeta.com' },
    {
      key: 'terms_and_conditions_text',
      value:
        'باستخدامك لمنصة Alphabeta Store وتسجيل حساب جديد، فإنك توافق على صحة البيانات المدخلة والالتزام بسياسات المتجر وإتمام الطلبات بطريقة نظامية.',
    },
    {
      key: 'privacy_policy_text',
      value:
        'تقوم منصة Alphabeta Store بجمع بياناتك الأساسية فقط لغرض تقديم الخدمة ومعالجة الطلبات والدفع والدعم، ولا يتم مشاركة بياناتك خارج نطاق التشغيل القانوني للخدمة.',
    },
  ];

  for (const setting of systemSettingsDefaults) {
    await prisma.systemSetting.upsert({
      where: {
        key: setting.key,
      },
      update: {
        value: setting.value,
      },
      create: {
        key: setting.key,
        value: setting.value,
      },
    });
  }

  // ─── Tech Category Tree ────────────────────────────────────────────────────
  type CategorySeed = {
    name: string;
    slug: string;
    icon?: string;
    sortOrder: number;
    children?: Omit<CategorySeed, 'children'>[];
  };

  const categoryTree: CategorySeed[] = [
    {
      name: 'Computers',
      slug: 'computers',
      icon: 'computer',
      sortOrder: 1,
      children: [
        { name: 'Laptops', slug: 'laptops', icon: 'laptop', sortOrder: 1 },
        { name: 'Desktops', slug: 'desktops', icon: 'desktop_windows', sortOrder: 2 },
        { name: 'Components', slug: 'components', icon: 'memory', sortOrder: 3 },
        { name: 'Monitors', slug: 'monitors', icon: 'monitor', sortOrder: 4 },
      ],
    },
    {
      name: 'Networking',
      slug: 'networking',
      icon: 'router',
      sortOrder: 2,
      children: [
        { name: 'Routers', slug: 'routers', icon: 'router', sortOrder: 1 },
        { name: 'Switches', slug: 'switches', icon: 'device_hub', sortOrder: 2 },
        { name: 'Access Points', slug: 'access-points', icon: 'wifi', sortOrder: 3 },
        { name: 'Network Cables', slug: 'network-cables', icon: 'cable', sortOrder: 4 },
      ],
    },
    {
      name: 'CCTV & Security',
      slug: 'cctv-security',
      icon: 'videocam',
      sortOrder: 3,
      children: [
        { name: 'IP Cameras', slug: 'ip-cameras', icon: 'camera_outdoor', sortOrder: 1 },
        { name: 'DVR & NVR', slug: 'dvr-nvr', icon: 'video_settings', sortOrder: 2 },
        { name: 'Security Accessories', slug: 'security-accessories', icon: 'security', sortOrder: 3 },
      ],
    },
    {
      name: 'POS Systems',
      slug: 'pos-systems',
      icon: 'point_of_sale',
      sortOrder: 4,
      children: [
        { name: 'POS Terminals', slug: 'pos-terminals', icon: 'terminal', sortOrder: 1 },
        { name: 'Barcode Scanners', slug: 'barcode-scanners', icon: 'qr_code_scanner', sortOrder: 2 },
        { name: 'Receipt Printers', slug: 'receipt-printers', icon: 'print', sortOrder: 3 },
        { name: 'Cash Drawers', slug: 'cash-drawers', icon: 'payments', sortOrder: 4 },
      ],
    },
    {
      name: 'Storage',
      slug: 'storage',
      icon: 'storage',
      sortOrder: 5,
      children: [
        { name: 'Hard Drives (HDD)', slug: 'hdd', icon: 'album', sortOrder: 1 },
        { name: 'Solid State Drives (SSD)', slug: 'ssd', icon: 'sim_card', sortOrder: 2 },
        { name: 'USB Flash Drives', slug: 'usb-flash-drives', icon: 'usb', sortOrder: 3 },
        { name: 'Memory Cards', slug: 'memory-cards', icon: 'sd_card', sortOrder: 4 },
        { name: 'NAS Enclosures', slug: 'nas', icon: 'dns', sortOrder: 5 },
      ],
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      icon: 'devices_other',
      sortOrder: 6,
      children: [
        { name: 'Keyboards & Mice', slug: 'keyboards-mice', icon: 'keyboard', sortOrder: 1 },
        { name: 'Headsets & Audio', slug: 'headsets-audio', icon: 'headset', sortOrder: 2 },
        { name: 'Cables & Adapters', slug: 'cables-adapters', icon: 'cable', sortOrder: 3 },
        { name: 'Bags & Cases', slug: 'bags-cases', icon: 'work', sortOrder: 4 },
        { name: 'Power & UPS', slug: 'power-ups', icon: 'battery_charging_full', sortOrder: 5 },
      ],
    },
    {
      name: 'Printers & Scanners',
      slug: 'printers-scanners',
      icon: 'print',
      sortOrder: 7,
      children: [
        { name: 'Inkjet Printers', slug: 'inkjet-printers', icon: 'print', sortOrder: 1 },
        { name: 'Laser Printers', slug: 'laser-printers', icon: 'print', sortOrder: 2 },
        { name: 'Scanners', slug: 'scanners', icon: 'scanner', sortOrder: 3 },
        { name: 'Printer Ink & Toner', slug: 'ink-toner', icon: 'colorize', sortOrder: 4 },
      ],
    },
    {
      name: 'Phones & Tablets',
      slug: 'phones-tablets',
      icon: 'smartphone',
      sortOrder: 8,
      children: [
        { name: 'Smartphones', slug: 'smartphones', icon: 'smartphone', sortOrder: 1 },
        { name: 'Tablets', slug: 'tablets', icon: 'tablet', sortOrder: 2 },
        { name: 'Phone Accessories', slug: 'phone-accessories', icon: 'phone_iphone', sortOrder: 3 },
      ],
    },
  ];

  for (const parent of categoryTree) {
    const parentRecord = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {
        name: parent.name,
        icon: parent.icon,
        sortOrder: parent.sortOrder,
        isActive: true,
        isVisible: true,
      },
      create: {
        name: parent.name,
        slug: parent.slug,
        icon: parent.icon,
        sortOrder: parent.sortOrder,
        isActive: true,
        isVisible: true,
      },
    });

    console.log(`[seed] Category upserted: ${parent.name}`);

    for (const child of parent.children ?? []) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          icon: child.icon,
          sortOrder: child.sortOrder,
          parentId: parentRecord.id,
          isActive: true,
          isVisible: true,
        },
        create: {
          name: child.name,
          slug: child.slug,
          icon: child.icon,
          sortOrder: child.sortOrder,
          parentId: parentRecord.id,
          isActive: true,
          isVisible: true,
        },
      });

      console.log(`[seed]   └─ Subcategory upserted: ${child.name}`);
    }
  }
}


main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });