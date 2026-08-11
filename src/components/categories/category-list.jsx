"use client";

import { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";

// LOCAL CUSTOM COMPONENTS
import MegaMenu1 from "./components/mega-menu/mega-menu-1";
import MegaMenu2 from "./components/mega-menu/mega-menu-2";
import CategoryListItem from "./components/category-list-item";
import { buildCategoryMenusFromTree, fetchCategoriesTree } from "utils/catalog";

// CUSTOM DATA MODEL


// STYLED COMPONENT
export const StyledRoot = styled("div", {
  shouldForwardProp: prop => prop !== "position"
})(({
  theme,
  position
}) => ({
  left: 0,
  zIndex: 98,
  right: "auto",
  borderRadius: 8,
  padding: "0.5rem 0px",
  transformOrigin: "top",
  boxShadow: theme.shadows[5],
  position: position || "unset",
  backgroundColor: theme.palette.background.paper,
  top: position === "absolute" ? "calc(100% + 0.7rem)" : "0.5rem",
  width: 278,
  minHeight: 40,
  "& .categories": {
    position: "absolute",
    top: "calc(100% + 8px)",
    insetInlineStart: 0,
    width: 278,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    overflow: "visible",
    boxShadow: theme.shadows[5]
  },
  ":dir(rtl) .mega-menu": {
    right: "100%",
    left: "auto"
  }
}));


// ==============================================================


// ==============================================================

export function CategoryList({
  position = "absolute"
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        setLoading(true);
        setError("");
        const tree = await fetchCategoriesTree(true);

        if (!active) return;

        setCategories(buildCategoryMenusFromTree(tree));
      } catch (loadError) {
        if (!active) return;

        setCategories([]);
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

  return <StyledRoot position={position}>
      {loading ? <div className="px-4 py-3">Loading...</div> : null}

      {!loading && error ? <div className="px-4 py-3">{error}</div> : null}

      {!loading && !error ? categories.map(item => {
      const MegaMenu = item.component === "Grid" ? MegaMenu1 : MegaMenu2;
      return <CategoryListItem key={item.title} href={item.href} icon={item.icon} title={item.title} caret={!!item.children} render={item.component ? <MegaMenu data={item.children} banner={item.offer} /> : null} />;
    }) : null}
    </StyledRoot>;
}
