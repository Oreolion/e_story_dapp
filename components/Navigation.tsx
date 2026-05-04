"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Home,
  Mic,
  Archive,
  Users,
  User,
  Moon,
  Sun,
  TrainTrack,
} from "lucide-react";
import { LogoMark } from "./LogoMark";
import { motion } from "framer-motion";
import { AuthButton } from "./AuthButton";
import { NotificationDropdown } from "./NotificationDropdown";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Record", href: "/record", icon: Mic },
  { name: "Archive", href: "/library", icon: Archive },
  { name: "Community", href: "/social", icon: Users },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Tracker", href: "/tracker", icon: TrainTrack },
];

export function Navigation() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 shrink-0">
            <motion.div whileHover={{ scale: 1.05 }}>
              <LogoMark size={28} />
            </motion.div>
            <span className="text-3xl font-bold bg-gradient-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] bg-clip-text text-transparent" style={{ fontFamily: "var(--font-brand)", WebkitTextStroke: "0.5px currentColor" }}>
              eStories
            </span>
          </Link>

          {/* Navigation Links - Center */}
          <div className="hidden lg:flex items-center gap-2 flex-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-[hsl(var(--memory-100))] dark:bg-[hsl(var(--memory-900)/0.3)] text-[hsl(var(--memory-600))] dark:text-[hsl(var(--memory-400))]"
                      : "text-gray-600 dark:text-gray-300 hover:text-[hsl(var(--memory-500))] dark:hover:text-[hsl(var(--memory-400))]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            {/* Notifications */}
            <NotificationDropdown />

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 p-0"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Auth Button */}
            <AuthButton />
          </div>
        </div>
      </div>
      {/* Mobile Navigation */}
      <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-around py-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--memory-100))] dark:bg-[hsl(var(--memory-900)/0.3)] text-[hsl(var(--memory-600))] dark:text-[hsl(var(--memory-400))]"
                    : "text-gray-600 dark:text-gray-300 hover:text-[hsl(var(--memory-500))]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
