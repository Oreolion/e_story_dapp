import { Suspense } from "react";
import type { Metadata } from "next";
import HomeFeed from "./HomeFeedClient";
export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Preparing your home…</p>}>
      <HomeFeed />
    </Suspense>
  );
}
