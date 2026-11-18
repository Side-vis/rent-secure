"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/dashboards/admin", label: "Overview", exact: true },
  { href: "/dashboards/admin/landlords", label: "Landlords", exact: false },
  { href: "/dashboards/admin/listings-verification", label: "Listings", exact: false },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-900 bg-slate-900/40 p-1.5"
    >
      {ADMIN_LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-100 text-slate-950"
                : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
