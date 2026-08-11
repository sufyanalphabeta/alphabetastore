import ShopLayout1 from "components/layouts/shop-layout-1";
import AuthGuard from "components/auth/auth-guard";

// API FUNCTIONS
import api from "utils/__api__/layout";

export const dynamic = "force-dynamic";

export default async function Layout1({
  children
}) {
  const data = await api.getLayoutData();
  if (!data) return <>{children}</>;
  return <ShopLayout1 data={data} hideSecondaryHeader>
      <AuthGuard>{children}</AuthGuard>
    </ShopLayout1>;
}