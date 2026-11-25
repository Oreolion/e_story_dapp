import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CookiePreferencesButton } from "./CookieConsent";
const groups = [
  {
    title: "Your stories",
    links: [
      ["Create a story", "/record"],
      ["Your archive", "/library"],
      ["Discover stories", "/social"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Care & support",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Account deletion", "/account-deletion"],
      ["Contact", "mailto:contact@estories.app"],
    ],
  },
];
export function Footer() {
  return (
    <footer className="border-t mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display text-2xl"
            >
              <BookOpen aria-hidden className="size-6 text-primary" />
              eStories
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The small moments. The turning points. A place to keep the stories
              that make a life.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Onchain verification is coming soon.
            </p>
          </div>
          {groups.map((group) => (
            <nav aria-label={group.title} key={group.title}>
              <p className="eyebrow mb-3">{group.title}</p>
              <ul>
                {group.links.map(([name, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
                    >
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 border-t pt-5 flex flex-wrap justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} eStories</p>
          <CookiePreferencesButton />
        </div>
      </div>
    </footer>
  );
}
