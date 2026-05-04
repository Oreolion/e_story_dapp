import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe — EStories",
  description: "Manage your email preferences.",
  robots: { index: false, follow: false },
};

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const category = typeof sp.category === "string" ? sp.category : "all";

  let title = "Unsubscribe";
  let message = "Processing your request…";

  if (status === "ok") {
    title =
      category === "re_engagement"
        ? "You've been unsubscribed from re-engagement emails."
        : category === "marketing"
        ? "You've been unsubscribed from marketing emails."
        : "You've been unsubscribed from all EStories emails.";
    message =
      "Transactional messages tied to things you do (subscription receipts, security alerts) may still be sent.";
  } else if (status === "invalid") {
    title = "Link expired or invalid";
    message =
      "This unsubscribe link is no longer valid. If you're still receiving unwanted emails, reply to one of them and we'll remove you manually.";
  } else if (status === "error") {
    title = "Something went wrong";
    message = "Please try again in a moment, or contact support@estories.app.";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-black mb-4">{title}</h1>
        <p className="text-gray-600 leading-relaxed">{message}</p>
        <Link
          href="/"
          className="inline-block mt-8 text-sm text-amber-700 underline"
        >
          Return to EStories
        </Link>
      </div>
    </main>
  );
}
