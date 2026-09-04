"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Check from "@mui/icons-material/Check";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Edit from "@mui/icons-material/Edit";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Link from "next/link";
import { fetchMyAddresses } from "utils/addresses";
import { fetchCustomerOrders } from "utils/orders";
import { fetchMyProfile } from "utils/users";
import { fetchWishlistItems } from "utils/wishlist";

const C = { primary: "#2563EB", deep: "#1E40AF", electric: "#3B82F6", page: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#64748B", secondary: "#F1F5F9", border: "#E2E8F0" };

function Metric({ value, label }) { return <Box sx={{ p: 1.5, textAlign: "center", bgcolor: C.secondary, borderRadius: 2 }}><Typography variant="h5" fontWeight={800} color={C.text}>{value}</Typography><Typography variant="caption" color={C.muted}>{label}</Typography></Box>; }
function Detail({ label, value, ltr }) { return <Box sx={{ p: 2, border: `1px solid ${C.border}`, borderRadius: 2 }}><Typography variant="caption" color={C.muted}>{label}</Typography><Typography dir={ltr ? "ltr" : undefined} sx={{ mt: .5, fontWeight: 600, color: C.text }}>{value || "غير مضاف"}</Typography></Box>; }

export function ProfilePageView() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ orders: 0, activeOrders: 0, wishlist: 0, addresses: 0 });
  const [copied, setCopied] = useState(false);
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyProfile(), fetchMyAddresses(), fetchCustomerOrders(), fetchWishlistItems()]).then(([profile, addresses, orders, wishlist]) => {
      if (cancelled) return;
      setUser(profile);
      setStats({ orders: orders.length, activeOrders: orders.filter(order => ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.rawStatus)).length, wishlist: wishlist.length, addresses: addresses.length });
    }).catch(error => { if (!cancelled) setPageError(error instanceof Error ? error.message : "تعذر تحميل الملف الشخصي."); }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copyCode = async () => {
    if (!user?.customerCode) return;
    try { await navigator.clipboard.writeText(user.customerCode); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* clipboard is optional */ }
  };

  return <Box dir="rtl" sx={{ bgcolor: C.page, minHeight: "100%", p: { xs: 1, sm: 2, md: 3 } }}>
    {pageError ? <Alert severity="error" sx={{ mb: 2 }}>{pageError}</Alert> : null}
    {isLoading ? <Stack alignItems="center" py={8}><CircularProgress sx={{ color: C.primary }} /></Stack> : null}
    {!isLoading && !pageError && user ? <Stack spacing={3}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}><Card elevation={0} sx={{ p: { xs: 2, md: 3 }, height: "100%", border: `1px solid ${C.border}`, borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}><Stack direction="row" spacing={2} alignItems="center"><Avatar sx={{ bgcolor: C.primary, width: 64, height: 64, fontSize: 26 }}>{user.name?.slice(0, 1)}</Avatar><Box><Typography variant="h5" fontWeight={800} color={C.text}>{user.name}</Typography><Typography dir="ltr" color={C.muted}>{user.email}</Typography><Typography variant="caption" color={C.muted}>عضو في المتجر</Typography></Box></Stack><Button component={Link} href="/profile/edit" variant="outlined" size="small" startIcon={<Edit sx={{ fontSize: 16 }} />}>تعديل</Button></Stack><Grid container spacing={1.5} sx={{ mt: 2 }}><Grid size={3}><Metric value={stats.orders} label="إجمالي الطلبات" /></Grid><Grid size={3}><Metric value={stats.activeOrders} label="قيد التنفيذ" /></Grid><Grid size={3}><Metric value={stats.wishlist} label="المفضلة" /></Grid><Grid size={3}><Metric value={stats.addresses} label="العناوين" /></Grid></Grid></Card></Grid>
        <Grid size={{ xs: 12, md: 5 }}><Card elevation={0} sx={{ p: { xs: 2, md: 3 }, height: "100%", color: "white", borderRadius: 2, background: `linear-gradient(135deg, ${C.deep}, ${C.electric})`, boxShadow: "0 18px 40px -22px rgba(30,64,175,.75)" }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="caption" sx={{ letterSpacing: 3, opacity: .85 }}>CUSTOMER ID</Typography><Chip size="small" icon={<VerifiedUser sx={{ fontSize: 14 }} />} label="عميل موثّق" sx={{ color: "white", bgcolor: "rgba(255,255,255,.16)" }} /></Stack><Button fullWidth onClick={copyCode} endIcon={copied ? <Check sx={{ fontSize: 18 }} /> : <ContentCopy sx={{ fontSize: 18 }} />} sx={{ mt: 3, justifyContent: "space-between", color: "white", border: "1px solid rgba(255,255,255,.3)", bgcolor: "rgba(255,255,255,.1)", fontFamily: "monospace", fontSize: 20, letterSpacing: 2, direction: "ltr", "&:hover": { bgcolor: "rgba(255,255,255,.2)" } }}>{user.customerCode || "—"}</Button><Typography variant="caption" sx={{ display: "block", mt: 1.5, opacity: .8 }}>استخدم هذا الكود عند التواصل مع خدمة العملاء لتسريع متابعة طلباتك.</Typography></Card></Grid>
      </Grid>
      <Card elevation={0} sx={{ p: { xs: 2, md: 3 }, border: `1px solid ${C.border}`, borderRadius: 2 }}><Typography fontWeight={800} color={C.text} sx={{ mb: 2 }}>البيانات الشخصية</Typography><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6, lg: 3 }}><Detail label="الاسم" value={user.name} /></Grid><Grid size={{ xs: 12, sm: 6, lg: 3 }}><Detail label="البريد الإلكتروني" value={user.email} ltr /></Grid><Grid size={{ xs: 12, sm: 6, lg: 3 }}><Detail label="رقم الهاتف" value={user.phone} ltr /></Grid><Grid size={{ xs: 12, sm: 6, lg: 3 }}><Detail label="طريقة الدفع المفضلة" value={user.preferredPaymentMethod === "COD" ? "الدفع عند الاستلام" : "تحويل مصرفي"} /></Grid></Grid></Card>
    </Stack> : null}
  </Box>;
}
