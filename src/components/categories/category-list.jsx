"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import { styled } from "@mui/material/styles";

import IconComponent from "components/IconComponent";
import useSettings from "hooks/useSettings";
import { fetchCategoriesTree, fetchBrandsPublic, getBrandLogoUrl } from "utils/catalog";

export const StyledRoot = styled("div", {
  shouldForwardProp: prop => prop !== "position"
})(({ theme, position }) => ({
  insetInlineStart: 0,
  zIndex: 98,
  top: position === "absolute" ? "calc(100% + 0.7rem)" : "0.5rem",
  position: position || "unset",
  width: "min(1000px, calc(100vw - 64px))",
  height: "min(68vh, 590px)",
  display: "grid",
  gridTemplateColumns: "270px minmax(0, 1fr)",
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  "& .category-roots": {
    overflowY: "auto",
    padding: theme.spacing(1),
    borderInlineEnd: `1px solid ${theme.palette.divider}`,
    background: theme.palette.grey[50]
  },
  "& .category-root": {
    width: "100%",
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.25),
    border: 0,
    borderRadius: 8,
    color: "inherit",
    background: "transparent",
    cursor: "pointer",
    textAlign: "start",
    font: "inherit"
  },
  "& .category-root[data-selected='true']": {
    color: theme.palette.primary.main,
    background: theme.palette.action.selected,
    fontWeight: 700
  },
  "& .root-title": { flex: 1 },
  "& .root-count": { color: theme.palette.text.secondary, fontSize: 12 },
  "& .root-arrow": { fontSize: 18, transform: theme.direction === "rtl" ? "none" : "rotate(180deg)" },
  "& .category-panel": { overflowY: "auto", padding: theme.spacing(3) },
  "& .panel-heading": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  "& .panel-title": { margin: 0, fontSize: 22, fontWeight: 800 },
  "& .view-all": { color: theme.palette.primary.main, fontWeight: 700, whiteSpace: "nowrap" },
  "& .category-groups": {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: theme.spacing(2.5, 3)
  },
  "& .group-title": { display: "block", fontWeight: 800, marginBottom: theme.spacing(0.75) },
  "& .branch-link": {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(0.45),
    color: theme.palette.text.secondary,
    fontSize: 14,
    "&:hover": { color: theme.palette.primary.main }
  },
  "& .branch-children": { paddingInlineStart: theme.spacing(1.5), borderInlineStart: `1px solid ${theme.palette.divider}` },
  "& .brand-strip": { marginTop: theme.spacing(3), paddingTop: theme.spacing(2), borderTop: `1px solid ${theme.palette.divider}` },
  "& .brand-strip-title": { fontWeight: 800, marginBottom: theme.spacing(1) },
  "& .brand-strip-items": { display: "flex", flexWrap: "wrap", gap: theme.spacing(1) },
  "& .brand-strip-item": { display: "inline-flex", alignItems: "center", gap: theme.spacing(0.75), padding: theme.spacing(0.5, 1), border: `1px solid ${theme.palette.divider}`, borderRadius: 8, color: "inherit", fontSize: 12, textDecoration: "none", "&:hover": { borderColor: theme.palette.primary.main, color: theme.palette.primary.main } },
  "& .brand-strip-logo": { width: 28, height: 22, display: "grid", placeItems: "center", fontWeight: 800, color: theme.palette.primary.main, "& img": { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } },
  [theme.breakpoints.down("lg")]: {
    width: "min(900px, calc(100vw - 32px))",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    "& .category-groups": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }
  }
}));

function BranchLinks({ nodes }) {
  return nodes.map(node => <div key={node.id}>
      <Link href={`/categories/${node.slug}`} className="branch-link">
        <span>{node.name}</span>
        <span>{node.productCount ?? 0}</span>
      </Link>
      {node.children?.length ? <div className="branch-children"><BranchLinks nodes={node.children} /></div> : null}
    </div>);
}

export function CategoryList({ position = "absolute" }) {
  const { settings } = useSettings();
  const isArabic = settings.default_language !== "en";
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchCategoriesTree(true), fetchBrandsPublic({ onlyVisible: true })])
      .then(([tree, brandItems]) => {
        if (!active) return;
        const roots = Array.isArray(tree) ? tree : [];
        setCategories(roots);
        setSelectedId(current => current && roots.some(item => item.id === current) ? current : roots[0]?.id || null);
        setError("");
        setBrands(Array.isArray(brandItems) ? brandItems.filter(item => Number(item.productCount ?? 0) > 0).slice(0, 10) : []);
      })
      .catch(loadError => active && setError(loadError.message || (isArabic ? "تعذر تحميل الفئات" : "Unable to load categories")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isArabic]);

  const selected = useMemo(
    () => categories.find(category => category.id === selectedId) || categories[0] || null,
    [categories, selectedId]
  );

  return <StyledRoot position={position}>
      <div className="category-roots" aria-label={isArabic ? "الفئات الرئيسية" : "Main categories"}>
        {loading ? <div className="p-3">{isArabic ? "جارٍ تحميل الفئات..." : "Loading categories..."}</div> : null}
        {!loading && error ? <div className="p-3">{error}</div> : null}
        {!loading && !error ? categories.map(item => <button
            type="button"
            className="category-root"
            data-selected={selected?.id === item.id}
            key={item.id}
            onMouseEnter={() => setSelectedId(item.id)}
            onFocus={() => setSelectedId(item.id)}
            onClick={event => {
              event.stopPropagation();
              setSelectedId(item.id);
            }}
          >
            {item.icon ? <IconComponent icon={item.icon} fontSize="small" /> : null}
            <span className="root-title">{item.name}</span>
            <span className="root-count">{item.productCount ?? 0}</span>
            <ChevronLeft className="root-arrow" />
          </button>) : null}
      </div>

      <div className="category-panel">
        {selected ? <>
            <div className="panel-heading">
              <h2 className="panel-title">{selected.name}</h2>
              <Link href={`/categories/${selected.slug}`} className="view-all">
                {isArabic ? "عرض الكل" : "View all"} ({selected.productCount ?? 0})
              </Link>
            </div>
            {selected.children?.length ? <div className="category-groups">
                {selected.children.map(group => <section key={group.id}>
                    <Link href={`/categories/${group.slug}`} className="group-title">
                      {group.name}
                    </Link>
                    <Link href={`/categories/${group.slug}`} className="branch-link">
                      <span>{isArabic ? "عرض الكل" : "View all"}</span>
                      <span>{group.productCount ?? 0}</span>
                    </Link>
                    {group.children?.length ? <BranchLinks nodes={group.children} /> : null}
                  </section>)}
              </div> : <Link href={`/categories/${selected.slug}`} className="view-all">
                {isArabic ? "تصفح منتجات هذه الفئة" : "Browse this category"}
              </Link>}
            {brands.length ? <div className="brand-strip" aria-label={isArabic ? "العلامات التجارية" : "Brands"}>
              <div className="brand-strip-title">{isArabic ? "تسوق حسب العلامة التجارية" : "Shop by brand"}</div>
              <div className="brand-strip-items">
                {brands.map(brand => <Link key={brand.id} href={`/brands/${brand.slug}`} className="brand-strip-item">
                  <span className="brand-strip-logo">{getBrandLogoUrl(brand) ? <img src={getBrandLogoUrl(brand)} alt="" /> : brand.name?.charAt(0)}</span>
                  <span>{brand.name}</span>
                </Link>)}
              </div>
            </div> : null}
          </> : null}
      </div>
    </StyledRoot>;
}
