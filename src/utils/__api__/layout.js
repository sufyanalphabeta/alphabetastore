import { cache } from "react";
import axios from "utils/axiosInstance";
import { buildCategoryMenusFromTree, fetchCategoriesTree } from "utils/catalog";

const getLayoutData = cache(async () => {
  const [categoryTree, settingsResponse] = await Promise.all([fetchCategoriesTree(true), axios.get("/settings")]);
  const settings = settingsResponse.data;
  const siteName = settings?.site_name || "Alphabeta Store";
  const logoUrl = settings?.site_logo_url?.trim() || "";
  const defaultLanguage = settings?.default_language === "en" ? "en" : "ar";
  const isArabic = defaultLanguage === "ar";

  const categoryMenus = buildCategoryMenusFromTree(categoryTree);
  // Keep leaf categories as links. An empty array is truthy in JavaScript and
  // made the navbar treat every leaf as an empty nested menu.
  const toNavigationItem = item => {
    const children = (item.children || []).map(toNavigationItem);
    return {
      title: item.title,
      url: item.href,
      ...(children.length ? { child: children } : {})
    };
  };
  const navigation = [
    { title: isArabic ? "الرئيسية" : "Home", url: "/" },
    { title: isArabic ? "كل المنتجات" : "All Products", url: "/products/search" },
    ...categoryMenus.filter(item => item.isFeatured).slice(0, 4).map(toNavigationItem),
    { title: isArabic ? "الخدمات" : "Services", url: "/services" }
  ];
  const mobileHeaderNavigation = [
    { title: isArabic ? "الرئيسية" : "Home", url: "/" },
    { title: isArabic ? "كل المنتجات" : "All Products", url: "/products/search" },
    {
      title: isArabic ? "جميع الفئات" : "All categories",
      url: "/mobile-categories",
      child: categoryMenus.map(toNavigationItem)
    },
    { title: isArabic ? "الخدمات" : "Services", url: "/services" }
  ];

  const aboutLinks = [{
    title: isArabic ? "الرئيسية" : "Home",
    url: "/"
  }, {
    title: isArabic ? "المنتجات" : "Products",
    url: "/products/search"
  }, {
    title: isArabic ? "الخدمات" : "Services",
    url: "/services"
  }];
  const customerLinks = [{
    title: isArabic ? "السلة" : "Cart",
    url: "/cart"
  }, {
    title: isArabic ? "الحساب" : "Account",
    url: "/profile"
  }, {
    title: isArabic ? "طلباتي" : "Orders",
    url: "/orders"
  }];

  return {
    topbar: {
      label: isArabic ? "التوصيل إلى" : "Deliver to",
      title: isArabic ? "ليبيا" : "Libya",
      languageOptions: [{
        title: "AR",
        value: "ar"
      }, {
        title: "EN",
        value: "en"
      }],
      socials: []
    },
    header: {
      logo: logoUrl,
      siteName,
      navigation,
      mobileNavigation: mobileHeaderNavigation
    },
    mobileNavigation: {
      logo: logoUrl,
      siteName,
      version1: [{
        icon: "Home",
        title: isArabic ? "الرئيسية" : "Home",
        href: "/"
      }, {
        icon: "CategoryOutline",
        title: isArabic ? "الفئات" : "Categories",
        href: "/mobile-categories"
      }, {
        icon: "Bag",
        title: isArabic ? "السلة" : "Cart",
        href: "/cart"
      }, {
        icon: "UserProfile",
        title: isArabic ? "الحساب" : "Account",
        href: "/profile"
      }]
    },
    footer: {
      logo: logoUrl,
      siteName,
      description: isArabic ? "Alphabeta Store مدعوم بواجهات خلفية حقيقية." : "Alphabeta Store powered by real backend APIs.",
      playStoreUrl: settings?.google_play_url || "",
      appStoreUrl: settings?.app_store_url || "",
      aboutTitle: isArabic ? "من نحن" : "About Us",
      customersTitle: isArabic ? "خدمة العملاء" : "Customer Care",
      about: aboutLinks,
      customers: customerLinks,
      contact: {
        title: isArabic ? "تواصل معنا" : "Contact Us",
        emailLabel: isArabic ? "البريد الإلكتروني" : "Email",
        phoneLabel: isArabic ? "الهاتف" : "Phone",
        phone: settings?.shop_phone || "+218000000000",
        email: settings?.support_email || "support@alphabeta.com",
        address: settings?.shop_address || "Tripoli, Libya"
      },
      socials: [],
      copyright: isArabic ? "جميع الحقوق محفوظة." : "All rights reserved."
    }
  };
});
export default {
  getLayoutData
};
