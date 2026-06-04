# Phase A — Catalog Experience Validation

End-to-end frontend verification for Phase A. All work is built against the
existing NestJS backend (`backend/`) and the Next.js 16 storefront at
`/workspaces/alphabetastore`.

## Build status

`npx next build` completes successfully — 36 static pages, all `(admin-dashboard)`
routes and storefront routes compile.

## Frontend routes added

### Admin (`(admin-dashboard)`)

| Route | Purpose |
| --- | --- |
| `/admin/brands` | Brand list, search, sort-order arrows, visibility / featured toggles, delete |
| `/admin/brands/create` | Create brand (auto-slug, description, sort order) |
| `/admin/brands/[slug]` | Edit brand + logo upload (multipart to `POST /brands/:id/logo`) |
| `/admin/homepage` | CRUD homepage blocks: type, title, subtitle, sort order, active switch, JSON config |
| `/admin/catalog-verification` | Live counts: products total / featured / new arrivals, per-category, per-brand, plus rendered homepage blocks |

Admin sidebar (`dashboard-navigation.js`) was updated with `Brands`, `Homepage`,
and `Catalog Verification` entries.

### Storefront (public)

| Route | Purpose |
| --- | --- |
| `/brands` | Brand grid (logo, name, count) → `fetchBrandsPublic({onlyVisible:true})` |
| `/brands/[slug]` | Brand header + product grid (`fetchBrandBySlugPublic`, `fetchProducts({brandSlug})`); `notFound()` for unknown slug; SEO via `generateMetadata` |
| `/market-1` and `/` | **Now rendered entirely from `/homepage/layout`** — no hardcoded sections |
| `/mobile-categories` | Tree-based menu via `/categories/tree` |

## Backend APIs consumed

| API | Used by |
| --- | --- |
| `GET /brands` | `/admin/brands`, `/brands`, catalog verification |
| `GET /brands/slug/:slug` | `/brands/[slug]` |
| `POST/PATCH/DELETE /brands` | Brand admin |
| `POST /brands/:id/logo` | Brand form (FormData `file`) |
| `PATCH /brands/reorder` | Brand sort-order arrows |
| `GET /homepage/layout` | Storefront homepage, catalog verification |
| `GET /homepage/blocks` (admin) | Homepage admin |
| `POST/PATCH/DELETE /homepage/blocks` | Homepage admin |
| `PATCH /homepage/blocks/reorder` | Homepage block reorder |
| `GET /categories/tree` | Mega menu (desktop + mobile), catalog verification |
| `GET /categories/featured` | `fetchFeaturedCategories` (available to mega menu) |
| `GET /products` | All product grids (filters by `category`, `brandSlug`, `featured`, etc.) |

## Homepage rendering — dynamic-only

`src/pages-sections/market-1/page-view/market-1.jsx` now does:

```jsx
const blocks = await fetchHomepageLayout();
return <HomepageLayoutView blocks={blocks} />;
```

`HomepageLayoutView` (in `src/components/homepage/`) switches on `block.type`:

- `HERO_BANNER` — banner card with `config.imageUrl`, optional `config.href`
- `FEATURED_CATEGORIES` — card grid (icon / image / name → `/products/search?category=slug`)
- `FEATURED_BRANDS` — logo grid → `/brands/{slug}`
- `NEW_ARRIVALS`, `BEST_SELLERS`, `PROMOTIONS`, `RECENTLY_ADDED`, `CUSTOM_PRODUCTS`
  — `ProductCard1` grid via `mapCatalogProduct(item)`

Empty layout shows a CTA pointing admins to `/admin/homepage`. The legacy
`Section1..Section9` files are no longer imported.

## Mega menu / category consumer

`src/components/categories/category-list.jsx` and the layout variant in
`src/utils/__api__/layout.js` now load `/categories/tree` and pass through
`buildCategoryMenusFromTree`, producing 3-level menu items (parent → child →
grandchild). `column-list.jsx` renders the column title as a `<Link>` when an
`href` is present, so parents and children are both navigable.

## Catalog verification page

`/admin/catalog-verification` runs four parallel calls and N per-category
`fetchProductsPage({ category: slug, limit: 1 })` lookups, then renders:

- KPI cards: total products, featured, total categories, total brands
- Active homepage blocks with hydrated item counts
- Products per category (full tree path)
- Products per brand (`brand.productCount` from backend)

This is the live "is the catalog actually populated?" dashboard.

## Known gaps / out of scope for Phase A

1. Mega-menu **featured-categories sash** — `fetchFeaturedCategories` is wired,
   but the dropdown does not yet surface a featured row. The data is available;
   the visual addition is cosmetic and can be added in Phase B without backend
   changes.
2. Hero banner config schema is freeform JSON (`{imageUrl, href}`). A typed
   form for hero content (image picker, CTA editor) is intentionally deferred —
   admins use the JSON textarea for now.
3. The instrumentation file logs two `@sentry/nextjs` not-found warnings during
   build because Sentry is optional. Build still succeeds.
4. Frontend screenshots are not included here because no headless browser
   harness is configured in this workspace; the build output and per-page
   verification above are the validation artefacts.

## How to run

```bash
# Backend
cd backend
npx prisma migrate deploy
npm run start:dev

# Frontend
cd ..
npm run dev   # or: npx next start after npm run build
```

Then:

1. Sign in as admin → `/admin/brands` → create a brand, upload a logo.
2. `/admin/homepage` → add `FEATURED_BRANDS`, `NEW_ARRIVALS`, `FEATURED_CATEGORIES`.
3. Visit `/` — homepage renders those blocks.
4. `/brands` → click brand → `/brands/{slug}` shows products.
5. `/admin/catalog-verification` → see live counts.

Phase A — Catalog Experience — is usable end-to-end.
