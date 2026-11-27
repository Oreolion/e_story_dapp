import type { Metadata } from "next";
import HomePage from "@/app/HomePageClient";
export const metadata: Metadata = {
  title: "Your story, in your own words",
  alternates: { canonical: "/" },
};
export default function Page() {
  return <HomePage publicWelcome />;
}
