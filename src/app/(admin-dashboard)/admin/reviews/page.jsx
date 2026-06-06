import ReviewModerationPageView from "pages-sections/vendor-dashboard/reviews/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Review Moderation - AlphaBeta Store Admin",
  description: "Moderate customer reviews.",
};

export default function AdminReviewsPage() {
  return <ReviewModerationPageView />;
}
