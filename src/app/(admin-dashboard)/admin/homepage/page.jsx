import { HomepageBlocksPageView } from "pages-sections/vendor-dashboard/homepage-blocks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Homepage - Alphabeta Store",
  description: "Configure storefront homepage blocks."
};

export default function HomepageAdmin() {
  return <HomepageBlocksPageView />;
}
