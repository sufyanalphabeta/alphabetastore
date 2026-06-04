"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// MUI
import Tooltip from "@mui/material/Tooltip";

// GLOBAL CUSTOM COMPONENTS
import SearchInput from "components/SearchInput";
import IconComponent from "components/IconComponent";
import OverlayScrollbar from "components/overlay-scrollbar";
import { MobileNavigationBar } from "components/mobile-navigation";
import { HeaderCart, HeaderLogin, MobileHeader, HeaderSearch } from "components/header";
import { MobileMenu } from "components/mobile-navbar/mobile-menu";
import { buildMobileCategoryMenus, fetchCategoriesTree } from "utils/catalog";

// STYLES
import { CategoryListItem, StyledRoot } from "./styles";

// TYPES


// ==============================================================


// ==============================================================

export default function MobileCategoriesPageView({
  data
}) {
  const {
    header,
    mobileNavigation
  } = data;
  const router = useRouter();
  const [categoryMenus, setCategoryMenus] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetchCategoriesTree(true);

        if (!active) return;

        const menus = buildMobileCategoryMenus(response);
        setCategoryMenus(menus);
        setSelected(menus[0] || null);
      } catch (loadError) {
        if (!active) return;

        setCategoryMenus([]);
        setSelected(null);
        setError(loadError.message || "Failed to load categories");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  return <StyledRoot>
      <div className="header">
        <MobileHeader>
          <MobileHeader.Left>
            <MobileMenu navigation={header.navigation} />
          </MobileHeader.Left>

          <MobileHeader.Logo logoUrl={mobileNavigation.logo} />

          <MobileHeader.Right>
            <HeaderSearch>
              <SearchInput />
            </HeaderSearch>

            <HeaderLogin />
            <HeaderCart />
          </MobileHeader.Right>
        </MobileHeader>
      </div>

      <OverlayScrollbar className="category-list">
        {loading ? <div className="p-3">Loading...</div> : null}

        {!loading && error ? <div className="p-3">{error}</div> : null}

        {!loading && !error ? categoryMenus.map((item, i) => <Tooltip key={i} title={item.title} placement="right" arrow>
            <CategoryListItem isActive={selected?.title === item.title} onClick={() => {
          if (item.children?.length) setSelected(item);else router.push(item.href);
        }}>
              <IconComponent icon={item.icon} className="icon" />
              <p className="title">{item.title}</p>
            </CategoryListItem>
          </Tooltip>) : null}
      </OverlayScrollbar>

      <div className="container">
        {loading ? <p>Loading...</p> : null}
        {!loading && error ? <p>{error}</p> : null}
        {!loading && !error && selected?.children?.length ? selected.children.map(item => <Link href={item.href} key={item.href} className="link">
              {item.title}
            </Link>) : null}
        {!loading && !error && selected && !selected.children?.length ? <Link href={selected.href} className="link">
            {selected.title}
          </Link> : null}
      </div>

      <MobileNavigationBar navigation={mobileNavigation.version1} />
    </StyledRoot>;
}