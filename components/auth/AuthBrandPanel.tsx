import { BookOpen, Mic, LockKeyhole } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";

/** Shared brand treatment for account entry and profile setup. No network or animation work. */
export function AuthBrandPanel({
  profileSetup = false,
}: {
  profileSetup?: boolean;
}) {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/10 bg-[#0b1029] p-8 text-slate-100 md:flex md:flex-col md:justify-between">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-12 size-80 rounded-full bg-[hsl(var(--insight-500)/.14)] blur-3xl"
      />
      <div className="relative flex items-center gap-2">
        <span aria-hidden="true">
          <LogoMark size={42} />
        </span>
        <span className="brand-wordmark text-4xl">eStories</span>
      </div>
      <div className="relative py-10">
        <div
          aria-hidden="true"
          className="mx-2 mb-9 rotate-[-3deg] rounded-xl border border-white/15 bg-white/[.04] px-5 py-6 shadow-xl"
        >
          <div className="mb-5 h-1 w-10 rounded bg-[hsl(var(--story-400))]" />
          <p className="text-xs tracking-[.16em] uppercase text-slate-400">
            A story, in your own words
          </p>
          <p className="mt-3 text-2xl font-semibold leading-snug">
            The moments.
            <br />
            The turning points.
            <br />
            The things worth keeping.
          </p>
          <div className="mt-6 flex h-8 items-center gap-1 text-[hsl(var(--memory-400))]">
            <Mic className="mr-2 size-4" />
            {[8, 16, 11, 24, 30, 18, 10, 22, 15, 7, 18, 26, 12, 6].map(
              (height, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-current"
                  style={{ height }}
                />
              ),
            )}
          </div>
        </div>
        <h2 className="text-2xl font-semibold leading-tight">
          {profileSetup
            ? "Your first story is one step away."
            : "A place for your stories."}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Speak freely, write about what matters, and build an archive you can
          return to.
        </p>
      </div>
      <ul className="relative space-y-3 border-t border-white/15 pt-5 text-sm text-slate-300">
        <li className="flex items-center gap-3">
          <BookOpen
            aria-hidden="true"
            className="size-4 shrink-0 text-[hsl(var(--story-400))]"
          />
          Write or record in your own words
        </li>
        <li className="flex items-center gap-3">
          <LockKeyhole
            aria-hidden="true"
            className="size-4 shrink-0 text-[hsl(var(--story-400))]"
          />
          Private until you choose to publish
        </li>
      </ul>
    </aside>
  );
}
