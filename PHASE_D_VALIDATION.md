# Phase D — Trust & Reviews Validation

## 1. Schema Changes

### New Enums
```sql
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE "QnAStatus"     AS ENUM ('PENDING', 'ANSWERED', 'HIDDEN');
```

### Product model additions
| Field | Type | Default |
|---|---|---|
| `ratingAvg` | `Decimal(3,2)` | `0` |
| `ratingCount` | `Int` | `0` |

### New models
| Model | Key fields |
|---|---|
| `Review` | `id, productId, userId, orderId?, rating(1-5), title?, comment?, status, isVerifiedPurchase, helpfulCount, moderatorNote?, images[]` |
| `ReviewImage` | `id, reviewId, imageUrl, sortOrder` |
| `ProductQnA` | `id, productId, userId, question, answer?, answeredAt?, status` |

Unique constraint: `@@unique([productId, userId])` on Review (one review per user per product).

---

## 2. Backend API Endpoints Added

### Reviews (`/products/:productId/reviews`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products/:id/reviews` | Public | Paginated APPROVED reviews, sortable |
| GET | `/products/:id/reviews/summary` | Public | avg, total, distribution{1-5} |
| GET | `/products/:id/reviews/mine` | JWT | Customer's own review |
| POST | `/products/:id/reviews` | JWT | Create review (multipart, 1-5 images) |
| PATCH | `/products/:id/reviews/:reviewId` | JWT | Update own review |
| DELETE | `/products/:id/reviews/:reviewId` | JWT | Delete own review |

### Review Moderation (Admin)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/reviews` | ADMIN | List all reviews with status filter |
| PATCH | `/admin/reviews/:id/moderate` | ADMIN | Approve / Reject / Hide + note |

### Product Q&A
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products/:id/qna` | Public | Paginated ANSWERED questions |
| POST | `/products/:id/qna` | JWT | Submit question (10–500 chars) |
| DELETE | `/products/:id/qna/:questionId` | JWT | Delete own unanswered question |

### Q&A Moderation (Admin)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/qna` | ADMIN | List questions with status filter |
| PATCH | `/admin/qna/:id/answer` | ADMIN | Post/edit answer |
| PATCH | `/admin/qna/:id/hide` | ADMIN | Hide question |

**Total new endpoints: 13**

---

## 3. Frontend Components Added

### Shared rating components (`src/components/ratings/`)
| File | Purpose |
|---|---|
| `StarRating.jsx` | Display-only star strip (0–5, half-star), shows count |
| `StarPicker.jsx` | Interactive star selector with hover labels |
| `RatingSummary.jsx` | Big avg + distribution bars |

### Product Detail integrations
| File | Change |
|---|---|
| `product-intro.jsx` | Star rating + "N reviews" anchor link below title |
| `product-tabs.jsx` | Added "Q&A" tab alongside Description / Specs / Reviews |
| `product-details.jsx` | Passes `<ProductReviews>` and `<ProductQnA>` to tabs |

### New page sections
| File | Purpose |
|---|---|
| `pages-sections/product-details/reviews/ProductReviews.jsx` | Full review section: summary, write form, sort, list, pagination |
| `pages-sections/product-details/qna/ProductQnA.jsx` | Q&A section: list answered Qs, ask form for logged-in users |

### Product card
| File | Change |
|---|---|
| `product-card-1/product-card.jsx` | Live rating + count display (hidden when 0) |

### Admin moderation panels
| File | Route |
|---|---|
| `vendor-dashboard/reviews/page-view.jsx` | `/admin/reviews` |
| `vendor-dashboard/qna/page-view.jsx` | `/admin/qna` |
| `app/(admin-dashboard)/admin/reviews/page.jsx` | Next.js route |
| `app/(admin-dashboard)/admin/qna/page.jsx` | Next.js route |

### Admin sidebar
`dashboard-navigation.js` — added "Reviews" (`/admin/reviews`) and "Product Q&A" (`/admin/qna`) entries after Support Tickets.

---

## 4. Moderation Workflow

```
Customer submits review
        │
        ▼
  status = PENDING
        │
        ▼
Admin visits /admin/reviews (filter: PENDING)
        │
  ┌─────┴──────────────┐
  ▼                     ▼
APPROVED              REJECTED / HIDDEN
  │
  ▼
ratingAvg & ratingCount recalculated on Product
  │
  ▼
Cache invalidated for product (tag: product-{id})
  │
  ▼
Live rating visible on storefront
```

**Verified Purchase**: `isVerifiedPurchase` is set automatically at creation time if the reviewer has a completed order that includes the product (checked via `OrderItem`). No manual override — prevents fake verification.

---

## 5. Trust Features Checklist

| Feature | Status |
|---|---|
| 1–5 star ratings on products | ✅ |
| Aggregate average + count stored on Product | ✅ |
| Rating visible on product cards (listing pages) | ✅ |
| Rating visible on product detail page (intro) | ✅ |
| Rating distribution bars (1★–5★ breakdown) | ✅ |
| Customer write / edit / delete own review | ✅ |
| Review title + comment | ✅ |
| Review photos (up to 5 images) | ✅ |
| Verified Purchase badge (auto-detected) | ✅ |
| Review sorting (newest/oldest/highest/lowest/verified) | ✅ |
| One review per customer per product (unique constraint) | ✅ |
| Admin review moderation (approve/reject/hide) | ✅ |
| Moderator note on rejected reviews | ✅ |
| New/edited reviews enter PENDING queue | ✅ |
| Product Q&A — customers ask questions | ✅ |
| Product Q&A — admin answers questions | ✅ |
| Product Q&A — admin can hide questions | ✅ |
| Q&A on product page (answered questions only) | ✅ |
| Admin Reviews panel with status filter | ✅ |
| Admin Q&A panel with answer/hide actions | ✅ |
| Arabic sidebar labels for Reviews and Q&A | ✅ |

---

## 6. Commerce Experience Score

| Dimension | Before Phase D | After Phase D | Change |
|---|---|---|---|
| Trust signals | None | Ratings, reviews, verified badge | +++ |
| Social proof | None | Review section on every product | +++ |
| Discovery feedback | None | Rating on cards + in search results | ++ |
| Admin oversight | None | Full moderation with workflow | +++ |
| Customer voice | None | Q&A + reviews | ++ |
| Purchase confidence | Low | Verified Purchase + photo reviews | +++ |

**Phase D fully signed off.**
