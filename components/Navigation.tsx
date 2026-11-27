"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Home,
  Mic,
  Archive,
  Users,
  User,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthButton } from "./AuthButton";
import { useAuth } from "./AuthProvider";
import { NotificationDropdown } from "./NotificationDropdown";
import { LogoMark } from "./LogoMark";

const workspace = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Archive", href: "/library", icon: Archive },
  { name: "Create", href: "/record", icon: Mic },
  { name: "Discover", href: "/social", icon: Users },
  { name: "You", href: "/profile", icon: User },
];
const publicLinks = [
  { name: "How it works", href: "/#how-it-works" },
  { name: "Discover", href: "/social" },
  { name: "Pricing", href: "/pricing" },
];
export function Navigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { profile } = useAuth();
  const links = profile ? workspace : publicLinks;
  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:flex-nowrap sm:px-6 lg:px-8">
          <Link
            href={profile ? "/home" : "/"}
            aria-label="eStories home"
            className="flex shrink-0 items-center gap-1"
          >
            <span aria-hidden="true"><LogoMark size={36} /></span>
            <span className="brand-wordmark text-3xl">eStories</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-1"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent aria-[current=page]:text-foreground aria-[current=page]:bg-accent"
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2 max-[359px]:w-full max-[359px]:justify-end">
            {profile && <NotificationDropdown />}
            <Button
              variant="ghost"
              size="icon"
              className={profile ? "" : "hidden sm:inline-flex"}
              aria-label="Toggle color theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun aria-hidden className="size-4 dark:hidden" />
              <Moon aria-hidden className="hidden size-4 dark:block" />
            </Button>
            <AuthButton />
            {!profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="lg:hidden"
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation menu"
                  >
                    <Menu aria-hidden className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="sm:hidden min-h-11" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme</DropdownMenuItem>
                  {publicLinks.map((item) => (
                    <DropdownMenuItem asChild key={item.href}>
                      <Link href={item.href} className="min-h-11">
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
      {profile && (
        <nav
          data-workspace-nav
          aria-label="Mobile workspace"
          className="fixed bottom-0 inset-x-0 z-50 border-t bg-background lg:hidden pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 max-w-lg mx-auto">
            {workspace.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="min-w-0 flex flex-col items-center gap-1 px-1 py-3 text-muted-foreground aria-[current=page]:text-primary hover:bg-accent"
              >
                <item.icon aria-hidden className="size-5" />
                <span className="text-xs">{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
