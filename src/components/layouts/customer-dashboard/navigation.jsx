"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AdminPanelSettings from "@mui/icons-material/AdminPanelSettings";
import { useRouter } from "next/navigation";

// CUSTOM COMPONENTS
import NavItem from "./nav-item";
import { useAuth } from "contexts/AuthContext";
import useSettings from "hooks/useSettings";

// STYLED COMPONENTS
import { MainContainer } from "./styles";
export function Navigation() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const {
    settings
  } = useSettings();
  const isArabic = settings.default_language === "ar";
  const isAdmin = user?.role === "ADMIN";

  const MENUS = [{
    title: isArabic ? "لوحة العميل" : "Dashboard",
    list: [{
      icon: "Packages",
      href: "/orders",
      title: isArabic ? "الطلبات" : "Orders"
    }, {
      icon: "HeartLine",
      href: "/wish-list",
      title: isArabic ? "المفضلة" : "Wishlist"
    }, {
      icon: "Headset",
      href: "/support-tickets",
      title: isArabic ? "تذاكر الدعم" : "Support Tickets"
    }]
  }, {
    title: isArabic ? "إعدادات الحساب" : "Account Settings",
    list: [{
      icon: "User3",
      href: "/profile",
      title: isArabic ? "الملف الشخصي" : "Profile Info"
    }, {
      icon: "Location",
      href: "/address",
      title: isArabic ? "العناوين" : "Addresses"
    }, {
      icon: "CreditCard",
      href: "/payment-methods",
      title: isArabic ? "طرق الدفع" : "Payment Methods"
    }]
  }];

  const handleLogout = async () => {
    await logout();
    window.location.assign("/login");
  };

  return <MainContainer>
      {MENUS.map(item => <Box mt={2} key={item.title}>
          <Typography fontSize={12} variant="body1" fontWeight={500} color="text.secondary" textTransform="uppercase" sx={{
        padding: ".75rem 1.75rem"
      }}>
            {item.title}
          </Typography>

          {item.list.map(listItem => <NavItem item={listItem} key={listItem.title} />)}
        </Box>)}

      <Box px={4} mt={6} pb={2} display="flex" flexDirection="column" gap={1.5}>
        {isAdmin && (
          <Tooltip title={isArabic ? "انتقل إلى لوحة تحكم الإدارة" : "Go to Admin Panel"} placement="top">
            <Button
              disableElevation
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<AdminPanelSettings />}
              onClick={() => router.push("/vendor/dashboard")}
              sx={{ fontWeight: 700 }}
            >
              {isArabic ? "لوحة الإدارة" : "Admin Dashboard"}
            </Button>
          </Tooltip>
        )}

        <Button disableElevation variant="outlined" color="primary" fullWidth onClick={handleLogout}>
          {isArabic ? "تسجيل الخروج" : "Logout"}
        </Button>
      </Box>
    </MainContainer>;
}