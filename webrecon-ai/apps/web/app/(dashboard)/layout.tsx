"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/browser", label: "Browser" },
  { href: "/network", label: "Network" },
  { href: "/dom", label: "DOM" },
  { href: "/screenshots", label: "Screenshots" },
  { href: "/assets", label: "Assets" },
  { href: "/ai-analysis", label: "AI Analysis" },
  { href: "/rebuild", label: "Rebuild" },
  { href: "/jobs", label: "Jobs" },
  { href: "/ai-providers", label: "AI Providers" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/mcp", label: "MCP" },
  { href: "/settings", label: "Settings" },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-white/60">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-4 py-4">
          <span className="text-sm font-semibold">WebRecon AI</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-primary/15 text-primary" : "text-white/70 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <p className="mb-2 truncate text-xs text-white/40">{user.email}</p>
          <button
            onClick={() => signOutUser()}
            className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  );
}
