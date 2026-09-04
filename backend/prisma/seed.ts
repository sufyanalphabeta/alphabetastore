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
    { key: 'theme', value: 'BAZAAR_ELECTRONICS' },
    { key: 'primary_color', value: '' },
    { key: 'enable_whatsapp', value: 'true' },
    { key: 'default_language', value: 'ar' },
    { key: 'direction', value: 'rtl' },
    { key: 'default_currency', value: 'LYD' },
    { key: 'exchange_rate_usd_to_lyd', value: '5.2' },
    { key: 'shop_phone', value: '+218000000000' },
    { key: 'shop_address', value: 'Tripoli, Libya' },
    { key: 'min_order', value: '0' },
    { key: 'support_email', value: 'support@alphabeta.com' },
    { key: 'footer_description', value: 'Alphabeta Store مدعوم بواجهات خلفية حقيقية.' },
    { key: 'footer_copyright', value: 'جميع الحقوق محفوظة.' },
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
      // Store settings are merchant-owned. Seed only fills missing keys and
      // must never overwrite values changed from the admin UI.
      update: {},
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
        isFeatured: true,
        isActive: true,
        isVisible: true,
      },
      create: {
        name: parent.name,
        slug: parent.slug,
        icon: parent.icon,
        sortOrder: parent.sortOrder,
        isFeatured: true,
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

  // ─── Electronics Brands ────────────────────────────────────────────────────
  type BrandSeed = {
    name: string;
    slug: string;
    description: string;
    isVisible: boolean;
    isFeatured: boolean;
    sortOrder: number;
  };

  const brands: BrandSeed[] = [
    { name: 'Dell', slug: 'dell', description: 'Laptops, desktops, and workstations for business and home.', isVisible: true, isFeatured: true, sortOrder: 1 },
    { name: 'HP', slug: 'hp', description: 'Printers, laptops, and enterprise hardware.', isVisible: true, isFeatured: true, sortOrder: 2 },
    { name: 'Lenovo', slug: 'lenovo', description: 'ThinkPad and IdeaPad laptops, plus data centre solutions.', isVisible: true, isFeatured: true, sortOrder: 3 },
    { name: 'Cisco', slug: 'cisco', description: 'Enterprise networking: routers, switches, and security.', isVisible: true, isFeatured: true, sortOrder: 4 },
    { name: 'Hikvision', slug: 'hikvision', description: 'IP cameras, NVRs, and security solutions.', isVisible: true, isFeatured: true, sortOrder: 5 },
    { name: 'TP-Link', slug: 'tp-link', description: 'Affordable networking: routers, switches, and access points.', isVisible: true, isFeatured: false, sortOrder: 6 },
    { name: 'Samsung', slug: 'samsung', description: 'Monitors, SSDs, phones, and peripherals.', isVisible: true, isFeatured: true, sortOrder: 7 },
    { name: 'Seagate', slug: 'seagate', description: 'Hard drives and storage solutions for consumers and enterprise.', isVisible: true, isFeatured: false, sortOrder: 8 },
    { name: 'WD (Western Digital)', slug: 'wd', description: 'HDDs, SSDs, and NAS solutions.', isVisible: true, isFeatured: false, sortOrder: 9 },
    { name: 'Dahua', slug: 'dahua', description: 'CCTV systems, NVR, and smart security products.', isVisible: true, isFeatured: false, sortOrder: 10 },
  ];

  const brandRecords: Record<string, { id: string }> = {};

  for (const brand of brands) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {
        name: brand.name,
        description: brand.description,
        isVisible: brand.isVisible,
        isFeatured: brand.isFeatured,
        sortOrder: brand.sortOrder,
      },
      create: {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        isVisible: brand.isVisible,
        isFeatured: brand.isFeatured,
        sortOrder: brand.sortOrder,
      },
    });
    brandRecords[brand.slug] = { id: record.id };
    console.log(`[seed] Brand upserted: ${brand.name}`);
  }

  // ─── Sample Products ───────────────────────────────────────────────────────
  // Look up category IDs needed for products.
  const catMap: Record<string, string> = {};
  const targetSlugs = ['laptops', 'desktops', 'routers', 'switches', 'access-points', 'ip-cameras', 'dvr-nvr', 'hdd', 'ssd', 'barcode-scanners'];
  for (const slug of targetSlugs) {
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (cat) catMap[slug] = cat.id;
  }

  type ProductSeed = {
    name: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: number;
    baseCurrency: 'LYD' | 'USD';
    stockQty: number;
    categorySlug: string;
    brandSlug: string;
    isFeatured: boolean;
    highlights: string[];
    specs: Record<string, string>;
    imageUrls?: string[];
  };

  const sampleProducts: ProductSeed[] = [
    {
      name: 'Dell Latitude 5540 Laptop',
      slug: 'dell-latitude-5540',
      shortDescription: '15.6" business laptop with Intel Core i5 and 16 GB RAM.',
      description: 'The Dell Latitude 5540 is designed for business productivity with strong security features, a comfortable keyboard, and long battery life.',
      price: 4200,
      baseCurrency: 'USD',
      stockQty: 25,
      categorySlug: 'laptops',
      brandSlug: 'dell',
      isFeatured: true,
      highlights: ['Intel Core i5-1345U', '16 GB DDR4', '512 GB SSD', 'Windows 11 Pro'],
      specs: { CPU: 'Intel Core i5-1345U', RAM: '16 GB', Storage: '512 GB NVMe SSD', Display: '15.6" FHD', OS: 'Windows 11 Pro' },
      imageUrls: ['/assets/images/products/demo/tech-laptop.jpg'],
    },
    {
      name: 'Lenovo ThinkPad E14 Gen 5',
      slug: 'lenovo-thinkpad-e14-gen5',
      shortDescription: 'Slim 14" business laptop, AMD Ryzen 5, 8 GB RAM.',
      description: 'The ThinkPad E14 Gen 5 delivers everyday performance in a sleek chassis with AMD Ryzen processors and rapid charging.',
      price: 3500,
      baseCurrency: 'USD',
      stockQty: 18,
      categorySlug: 'laptops',
      brandSlug: 'lenovo',
      isFeatured: true,
      highlights: ['AMD Ryzen 5 7530U', '8 GB LPDDR5', '256 GB SSD', 'Rapid Charge'],
      specs: { CPU: 'AMD Ryzen 5 7530U', RAM: '8 GB', Storage: '256 GB SSD', Display: '14" FHD IPS', Battery: '57 Wh' },
      imageUrls: ['/assets/images/products/demo/office-laptop.jpg'],
    },
    {
      name: 'HP EliteDesk 800 G9 Mini',
      slug: 'hp-elitedesk-800-g9-mini',
      shortDescription: 'Compact mini PC for enterprise desktops, Core i7.',
      description: 'A tiny-footprint desktop built for enterprise reliability with Intel vPro and TPM 2.0 security.',
      price: 5800,
      baseCurrency: 'USD',
      stockQty: 10,
      categorySlug: 'desktops',
      brandSlug: 'hp',
      isFeatured: false,
      highlights: ['Intel Core i7-12700', '16 GB DDR5', '512 GB SSD', 'Intel vPro'],
      specs: { CPU: 'Intel Core i7-12700', RAM: '16 GB DDR5', Storage: '512 GB SSD', Form: 'Mini PC', TPM: '2.0' },
      imageUrls: ['/assets/images/products/demo/blue-laptop.jpg'],
    },
    {
      name: 'Cisco RV340 Dual WAN Router',
      slug: 'cisco-rv340-dual-wan',
      shortDescription: 'Small-business router with dual WAN and VPN support.',
      description: 'The Cisco RV340 provides advanced routing, firewall, and VPN features tailored for small-to-medium businesses.',
      price: 1850,
      baseCurrency: 'USD',
      stockQty: 30,
      categorySlug: 'routers',
      brandSlug: 'cisco',
      isFeatured: true,
      highlights: ['Dual WAN failover', 'IPSec/SSL VPN', 'Firewall', 'Gigabit ports'],
      specs: { WAN: 'Dual Gigabit', VPN: 'IPSec / SSL / PPTP', Firewall: 'SPI', Ports: '4× Gigabit LAN' },
    },
    {
      name: 'TP-Link TL-SG108 8-Port Switch',
      slug: 'tp-link-sg108',
      shortDescription: 'Unmanaged 8-port Gigabit switch for home and office.',
      description: 'Plug-and-play Gigabit switch offering reliable and fast network connectivity with zero configuration.',
      price: 280,
      baseCurrency: 'USD',
      stockQty: 60,
      categorySlug: 'switches',
      brandSlug: 'tp-link',
      isFeatured: false,
      highlights: ['8× Gigabit ports', 'Plug-and-play', 'Metal casing', 'Energy-efficient'],
      specs: { Ports: '8× 10/100/1000 Mbps', Power: '8.4 W max', Dimensions: '158×101×25 mm', Standard: 'IEEE 802.3ab' },
    },
    {
      name: 'TP-Link EAP670 Wi-Fi 6 Access Point',
      slug: 'tp-link-eap670',
      shortDescription: 'Wi-Fi 6 ceiling AP, up to 5.4 Gbps dual-band.',
      description: 'The EAP670 delivers blazing-fast Wi-Fi 6 speeds with MU-MIMO and OFDMA for dense environments.',
      price: 620,
      baseCurrency: 'USD',
      stockQty: 40,
      categorySlug: 'access-points',
      brandSlug: 'tp-link',
      isFeatured: true,
      highlights: ['Wi-Fi 6 (802.11ax)', '5.4 Gbps combined', 'MU-MIMO 4×4', 'PoE powered'],
      specs: { Standard: '802.11ax (Wi-Fi 6)', Speed: '5.4 Gbps', Antennas: '8× internal', PoE: '802.3at' },
    },
    {
      name: 'Hikvision DS-2CD2143G2-I Dome Camera',
      slug: 'hikvision-ds-2cd2143g2',
      shortDescription: '4 MP AcuSense fixed dome, 2.8 mm, IR 40 m.',
      description: 'AcuSense technology reduces false alarms by accurately distinguishing humans and vehicles.',
      price: 480,
      baseCurrency: 'USD',
      stockQty: 50,
      categorySlug: 'ip-cameras',
      brandSlug: 'hikvision',
      isFeatured: true,
      highlights: ['4 MP resolution', 'AcuSense AI detection', 'IR range 40 m', 'IP67 weatherproof'],
      specs: { Resolution: '4 MP (2688×1520)', Lens: '2.8 mm', IR: '40 m', Protection: 'IP67 / IK10' },
    },
    {
      name: 'Dahua NVR4108HS-8P-4KS2 8-Ch NVR',
      slug: 'dahua-nvr4108hs-8p',
      shortDescription: '8-channel PoE NVR, H.265+, 4K decoding.',
      description: 'Supports up to 8 IP cameras with built-in PoE, H.265+ compression, and 4K decoding capability.',
      price: 950,
      baseCurrency: 'USD',
      stockQty: 20,
      categorySlug: 'dvr-nvr',
      brandSlug: 'dahua',
      isFeatured: false,
      highlights: ['8× PoE ports', 'H.265+ compression', '4K decoding', '2× HDD bays'],
      specs: { Channels: '8', Compression: 'H.265+ / H.265', PoE: '8 ports (total 120 W)', Resolution: 'Up to 4K' },
    },
    {
      name: 'Seagate BarraCuda 2 TB HDD',
      slug: 'seagate-barracuda-2tb',
      shortDescription: '3.5" SATA hard drive, 2 TB, 7200 RPM.',
      description: 'Reliable storage for desktops and NAS with high transfer speeds and a 2-year warranty.',
      price: 380,
      baseCurrency: 'USD',
      stockQty: 80,
      categorySlug: 'hdd',
      brandSlug: 'seagate',
      isFeatured: false,
      highlights: ['2 TB capacity', '7200 RPM', '256 MB cache', 'SATA 6 Gb/s'],
      specs: { Capacity: '2 TB', Interface: 'SATA 6 Gb/s', RPM: '7200', Cache: '256 MB' },
    },
    {
      name: 'Samsung 870 EVO 1 TB SSD',
      slug: 'samsung-870-evo-1tb',
      shortDescription: 'SATA III 2.5" SSD with up to 560 MB/s read speed.',
      description: 'The Samsung 870 EVO offers best-in-class sequential speeds and endurance for everyday computing.',
      price: 650,
      baseCurrency: 'USD',
      stockQty: 45,
      categorySlug: 'ssd',
      brandSlug: 'samsung',
      isFeatured: true,
      highlights: ['1 TB capacity', '560 MB/s read', '530 MB/s write', '600 TBW endurance'],
      specs: { Capacity: '1 TB', Interface: 'SATA III', 'Read Speed': '560 MB/s', 'Write Speed': '530 MB/s', Endurance: '600 TBW' },
    },
  ];

  for (const p of sampleProducts) {
    const categoryId = catMap[p.categorySlug];
    const brandId = brandRecords[p.brandSlug]?.id;
    if (!categoryId) {
      console.warn(`[seed] Category not found for slug: ${p.categorySlug} — skipping ${p.name}`);
      continue;
    }
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        baseCurrency: p.baseCurrency,
        stockQty: p.stockQty,
        categoryId,
        brandId: brandId ?? null,
        brand: p.brandSlug,
        isFeatured: p.isFeatured,
        highlights: p.highlights,
        specs: p.specs,
        status: 'ACTIVE',
      },
      create: {
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        stockQty: p.stockQty,
        categoryId,
        brandId: brandId ?? null,
        brand: p.brandSlug,
        isFeatured: p.isFeatured,
        highlights: p.highlights,
        specs: p.specs,
        status: 'ACTIVE',
        baseCurrency: p.baseCurrency,
        images: p.imageUrls?.length
          ? { create: p.imageUrls.map((imageUrl, index) => ({ imageUrl, sortOrder: index })) }
          : undefined,
      },
    });
    console.log(`[seed] Product upserted: ${p.name}`);
  }

  // Provide a useful storefront immediately after a fresh install. Admins can
  // later edit, reorder, or remove these blocks from /admin/homepage.
  if ((await prisma.homepageBlock.count()) === 0) {
    const defaultBlocks = [
      {
        type: 'HERO_BANNER' as const,
        title: 'Alphabeta Store | متجر ألفا بيتا',
        subtitle: 'Technology for home, office, and business',
        config: {},
        sortOrder: 1,
      },
      {
        type: 'FEATURED_CATEGORIES' as const,
        title: 'Shop by category',
        subtitle: 'Find the right technology faster',
        config: { limit: 8 },
        sortOrder: 2,
      },
      {
        type: 'NEW_ARRIVALS' as const,
        title: 'Latest products',
        subtitle: 'New additions to our catalog',
        config: { limit: 8 },
        sortOrder: 3,
      },
      {
        type: 'FEATURED_BRANDS' as const,
        title: 'Trusted brands',
        config: { limit: 8 },
        sortOrder: 4,
      },
    ];

    for (const block of defaultBlocks) {
      await prisma.homepageBlock.create({ data: block });
    }
    console.log(`[seed] Created ${defaultBlocks.length} default homepage blocks.`);
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
