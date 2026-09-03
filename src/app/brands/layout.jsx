import ShopLayout1 from "components/layouts/shop-layout-1";
import api from "utils/__api__/layout";

export const dynamic = "force-dynamic";

export default async function BrandsLayout({ children }) {
  const data = await api.getLayoutData();
  return <ShopLayout1 data={data}>{children}</ShopLayout1>;
}
