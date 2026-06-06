"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

// GLOBAL CUSTOM COMPONENT
import OverlayScrollbar from "components/overlay-scrollbar";
import { useAuth } from "contexts/AuthContext";
import useSettings from "hooks/useSettings";

// LOCAL CUSTOM COMPONENT
import SidebarAccordion from "./sidebar-accordion";

// LOCAL CUSTOM HOOKS
import { useLayout } from "../dashboard-layout-context";

// SIDEBAR NAVIGATION LIST
import { navigation } from "../dashboard-navigation";

// STYLED COMPONENTS
import { ListLabel, BadgeValue, StyledText, BulletIcon, ExternalLink, NavItemButton, ListIconWrapper } from "./styles";

const ARABIC_LABELS = {
  Admin: "الإدارة",
  Settings: "الإعدادات",
  Dashboard: "لوحة التحكم",
  Products: "المنتجات",
  "Product List": "قائمة المنتجات",
  "Create Product": "إضافة منتج",
  Categories: "الفئات",
  "Category List": "قائمة الفئات",
  "Create Category": "إضافة فئة",
  Orders: "الطلبات",
  "Order List": "قائمة الطلبات",
  "Order Details": "تفاصيل الطلب",
  Payments: "المدفوعات",
  "Support Tickets": "تذاكر الدعم",
  Customers: "العملاء",
  Refunds: "الاسترجاعات",
  "Refund Request": "طلب استرجاع",
  "Refund Settings": "إعدادات الاسترجاع",
  Sellers: "البائعون",
  "Seller List": "قائمة البائعين",
  "Seller Package": "باقة البائع",
  "Package Payments": "مدفوعات الباقات",
  "Earning History": "سجل الأرباح",
  Payouts: "عمليات السحب",
  "Payout Request": "طلب سحب",
  "Payout Settings": "إعدادات السحب",
  Earnings: "الأرباح",
  Reviews: "المراجعات",
  "Product Q&A": "أسئلة وأجوبة المنتجات",
  Bundles: "الحزم",
  Variants: "المتغيرات",
  Relations: "العلاقات",
  "Shop Setting": "إعدادات المتجر",
  "Account Settings": "إعدادات الحساب",
  "Site Settings": "إعدادات الموقع",
  Logout: "تسجيل الخروج"
};

function localizeNavigationItems(items, isArabic) {
  if (!isArabic) {
    return items;
  }

  return items.map(item => {
    const localized = {
      ...item
    };

    if (typeof localized.name === "string") {
      localized.name = ARABIC_LABELS[localized.name] || localized.name;
    }

    if (typeof localized.label === "string") {
      localized.label = ARABIC_LABELS[localized.label] || localized.label;
    }

    if (Array.isArray(localized.children)) {
      localized.children = localizeNavigationItems(localized.children, true);
    }

    return localized;
  });
}

export default function MultiLevelMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const {
    COMPACT,
    TOP_HEADER_AREA,
    handleCloseMobileSidebar
  } = useLayout();
  const {
    settings
  } = useSettings();
  const localizedNavigation = localizeNavigationItems(navigation, settings.default_language === "ar");

  
// HANDLE ACTIVE CURRENT PAGE
  const activeRoute = path => pathname === path ? 1 : 0;
  const handleLogout = async () => {
    handleCloseMobileSidebar();
    await logout();
    window.location.assign("/login");
  };

  const renderLevels = data => {
    return data.map((item, index) => {
      if (item.type === "label") {
        return <ListLabel key={index} compact={COMPACT}>
            {item.label}
          </ListLabel>;
      }
      if (item.children) {
        return <SidebarAccordion key={index} item={item}>
            {renderLevels(item.children)}
          </SidebarAccordion>;
      }
      if (item.type === "extLink") {
        return <ExternalLink key={index} href={item.path} rel="noopener noreferrer" target="_blank">
            <NavItemButton key={item.name} name="child" active={0}>
              {item.icon ? <ListIconWrapper>
                  <item.icon />
                </ListIconWrapper> : <span className="item-icon icon-text">{item.iconText}</span>}

              <StyledText compact={COMPACT}>{item.name}</StyledText>

              {item.badge ? <BadgeValue compact={COMPACT}>{item.badge.value}</BadgeValue> : null}
            </NavItemButton>
          </ExternalLink>;
      }
      if (item.action === "logout") {
        return <NavItemButton className="navItem" key={index} active={0} onClick={handleLogout}>
            {item?.icon ? <ListIconWrapper>
                <item.icon />
              </ListIconWrapper> : <BulletIcon active={0} />}

            <StyledText compact={COMPACT}>{item.name}</StyledText>
          </NavItemButton>;
      }
      return <Link key={index} href={item.path} passHref>
          <NavItemButton className="navItem" active={activeRoute(item.path)} onClick={handleCloseMobileSidebar}>
            {item?.icon ? <ListIconWrapper>
                <item.icon />
              </ListIconWrapper> : <BulletIcon active={activeRoute(item.path)} />}

            <StyledText compact={COMPACT}>{item.name}</StyledText>

            {item.badge ? <BadgeValue compact={COMPACT}>{item.badge.value}</BadgeValue> : null}
          </NavItemButton>
        </Link>;
    });
  };
  return <OverlayScrollbar sx={{
    px: 2,
    overflowX: "hidden",
    maxHeight: `calc(100vh - ${TOP_HEADER_AREA}px)`
  }}>
      {renderLevels(localizedNavigation)}
    </OverlayScrollbar>;
}