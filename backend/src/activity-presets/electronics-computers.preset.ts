export type PresetAttribute = {
  code: string;
  nameAr: string;
  nameEn: string;
  dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';
  unit?: string;
  allowedValues?: string[];
};

export type PresetProfile = {
  key: string;
  name: string;
  categorySlugs: string[];
  attributes: Array<{ code: string; required?: boolean; filterable?: boolean; comparable?: boolean; visibleOnProduct?: boolean; visibleInSummary?: boolean }>;
};

export const ELECTRONICS_COMPUTERS_PRESET = {
  code: 'ELECTRONICS_COMPUTERS',
  nameAr: 'الإلكترونيات والكمبيوتر',
  nameEn: 'Electronics & Computers',
  version: 1,
  description: 'إعداد عملي للفئات والخصائص الأساسية لمتجر الإلكترونيات والكمبيوتر.',
  attributes: [
    { code: 'brand', nameAr: 'العلامة التجارية', nameEn: 'Brand', dataType: 'TEXT' },
    { code: 'model', nameAr: 'الموديل', nameEn: 'Model', dataType: 'TEXT' },
    { code: 'processor', nameAr: 'المعالج', nameEn: 'Processor', dataType: 'TEXT' },
    { code: 'ram', nameAr: 'الذاكرة RAM', nameEn: 'RAM', dataType: 'TEXT' },
    { code: 'storage_capacity', nameAr: 'السعة', nameEn: 'Capacity', dataType: 'TEXT' },
    { code: 'screen_size', nameAr: 'حجم الشاشة', nameEn: 'Screen Size', dataType: 'NUMBER', unit: 'inch' },
    { code: 'gpu', nameAr: 'بطاقة الرسوميات', nameEn: 'GPU', dataType: 'TEXT' },
    { code: 'operating_system', nameAr: 'نظام التشغيل', nameEn: 'Operating System', dataType: 'TEXT' },
    { code: 'resolution', nameAr: 'الدقة', nameEn: 'Resolution', dataType: 'TEXT' },
    { code: 'panel_type', nameAr: 'نوع اللوحة', nameEn: 'Panel Type', dataType: 'TEXT' },
    { code: 'refresh_rate', nameAr: 'معدل التحديث', nameEn: 'Refresh Rate', dataType: 'NUMBER', unit: 'Hz' },
    { code: 'ports', nameAr: 'المنافذ', nameEn: 'Ports', dataType: 'TEXT' },
    { code: 'device_type', nameAr: 'نوع الجهاز', nameEn: 'Device Type', dataType: 'TEXT' },
    { code: 'network_speed', nameAr: 'سرعة الشبكة', nameEn: 'Network Speed', dataType: 'TEXT' },
    { code: 'wifi_standard', nameAr: 'معيار Wi‑Fi', nameEn: 'Wi‑Fi Standard', dataType: 'TEXT' },
    { code: 'poe', nameAr: 'يدعم PoE', nameEn: 'PoE', dataType: 'BOOLEAN' },
    { code: 'camera_type', nameAr: 'نوع الكاميرا', nameEn: 'Camera Type', dataType: 'TEXT' },
    { code: 'lens', nameAr: 'العدسة', nameEn: 'Lens', dataType: 'TEXT' },
    { code: 'night_vision', nameAr: 'الرؤية الليلية', nameEn: 'Night Vision', dataType: 'BOOLEAN' },
    { code: 'interface', nameAr: 'الواجهة', nameEn: 'Interface', dataType: 'TEXT' },
    { code: 'form_factor', nameAr: 'الشكل', nameEn: 'Form Factor', dataType: 'TEXT' },
    { code: 'read_speed', nameAr: 'سرعة القراءة', nameEn: 'Read Speed', dataType: 'TEXT' },
    { code: 'write_speed', nameAr: 'سرعة الكتابة', nameEn: 'Write Speed', dataType: 'TEXT' },
    { code: 'cache', nameAr: 'الذاكرة المؤقتة', nameEn: 'Cache', dataType: 'TEXT' },
    { code: 'printer_type', nameAr: 'نوع الطابعة', nameEn: 'Printer Type', dataType: 'TEXT' },
    { code: 'connectivity', nameAr: 'الاتصال', nameEn: 'Connectivity', dataType: 'TEXT' },
    { code: 'print_technology', nameAr: 'تقنية الطباعة', nameEn: 'Print Technology', dataType: 'TEXT' },
    { code: 'color_mode', nameAr: 'الألوان', nameEn: 'Color Mode', dataType: 'TEXT' },
    { code: 'print_speed', nameAr: 'سرعة الطباعة', nameEn: 'Print Speed', dataType: 'TEXT' },
    { code: 'power_capacity', nameAr: 'القدرة', nameEn: 'Power Capacity', dataType: 'TEXT' },
    { code: 'battery_type', nameAr: 'نوع البطارية', nameEn: 'Battery Type', dataType: 'TEXT' },
    { code: 'runtime', nameAr: 'مدة التشغيل', nameEn: 'Runtime', dataType: 'TEXT' },
    { code: 'output_type', nameAr: 'نوع الخرج', nameEn: 'Output Type', dataType: 'TEXT' },
  ] satisfies PresetAttribute[],
  profiles: [
    { key: 'LAPTOPS', name: 'Electronics / Laptops', categorySlugs: ['laptops'], attributes: ['brand', 'model', 'processor', 'ram', 'storage_capacity', 'screen_size', 'gpu', 'operating_system'] },
    { key: 'MONITORS', name: 'Electronics / Monitors', categorySlugs: ['monitors'], attributes: ['brand', 'model', 'screen_size', 'resolution', 'panel_type', 'refresh_rate', 'ports'] },
    { key: 'NETWORKING', name: 'Electronics / Networking', categorySlugs: ['networking'], attributes: ['brand', 'model', 'device_type', 'network_speed', 'ports', 'wifi_standard', 'poe'] },
    { key: 'CCTV', name: 'Electronics / CCTV', categorySlugs: ['cctv-security'], attributes: ['brand', 'model', 'camera_type', 'resolution', 'lens', 'night_vision', 'poe'] },
    { key: 'STORAGE', name: 'Electronics / Storage', categorySlugs: ['storage'], attributes: ['brand', 'model', 'storage_capacity', 'interface', 'form_factor', 'read_speed', 'write_speed', 'cache'] },
    { key: 'POS', name: 'Electronics / POS', categorySlugs: ['pos-systems'], attributes: ['brand', 'model', 'device_type', 'screen_size', 'printer_type', 'connectivity'] },
    { key: 'PRINTERS', name: 'Electronics / Printers', categorySlugs: ['printers-scanners'], attributes: ['brand', 'model', 'printer_type', 'print_technology', 'color_mode', 'print_speed', 'connectivity'] },
    { key: 'UPS_POWER', name: 'Electronics / Power & UPS', categorySlugs: ['power-ups'], attributes: ['brand', 'model', 'power_capacity', 'battery_type', 'runtime', 'output_type'] },
  ].map(profile => ({
    ...profile,
    attributes: profile.attributes.map((code, index) => ({
      code,
      required: index < 2,
      filterable: ['brand', 'storage_capacity', 'screen_size', 'resolution', 'refresh_rate', 'network_speed', 'power_capacity'].includes(code),
      comparable: ['processor', 'ram', 'storage_capacity', 'screen_size', 'resolution', 'refresh_rate', 'network_speed', 'power_capacity'].includes(code),
      visibleOnProduct: true,
      visibleInSummary: index < 4,
    })),
  })) satisfies PresetProfile[],
} as const;

export const FUTURE_ACTIVITY_CODES = ['FASHION', 'GROCERY', 'PHARMACY', 'PERFUMES', 'AUTO_PARTS', 'GENERAL_STORE'] as const;
