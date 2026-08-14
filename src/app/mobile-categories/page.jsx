import MobileCategoriesPageView from "./page-view";
import api from "utils/__api__/layout";
export default async function MobileCategories() {
  const data = await api.getLayoutData();
  return <MobileCategoriesPageView data={data} />;
}
