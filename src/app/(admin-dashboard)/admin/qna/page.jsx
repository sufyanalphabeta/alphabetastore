import QnAModerationPageView from "pages-sections/vendor-dashboard/qna/page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Product Q&A - AlphaBeta Store Admin",
  description: "Manage customer questions and answers.",
};

export default function AdminQnAPage() {
  return <QnAModerationPageView />;
}
