import { Fragment } from "react";

// GLOBAL COMPONENTS
import Setting from "components/settings";
import Newsletter from "components/newsletter";
import HomepageLayoutView from "components/homepage/HomepageLayoutView";
import { fetchHomepageLayout } from "utils/catalog";

export default async function MarketOnePageView() {
  let blocks = [];
  try {
    blocks = await fetchHomepageLayout();
  } catch {
    blocks = [];
  }

  return (
    <Fragment>
      {/* DYNAMIC HOMEPAGE BLOCKS — configured from /admin/homepage */}
      <HomepageLayoutView blocks={Array.isArray(blocks) ? blocks : []} />

      {/* POPUP NEWSLETTER FORM */}
      <Newsletter />

      {/* SETTINGS IS USED ONLY FOR DEMO, YOU CAN REMOVE THIS */}
      <Setting />
    </Fragment>
  );
}