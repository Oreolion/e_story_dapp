import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] opacity-20" />
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <h2 className="text-xl font-semibold text-muted-foreground">
          Page not found
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] text-white text-sm font-medium"
        >
          Go Home
        </Link>
        <Link
          href="/social"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Community
        </Link>
      </div>
    </div>
  );
}
