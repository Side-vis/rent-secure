"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getDashboardRoute, isRole, type Role } from "@/lib/roles";

type GuardStatus = "checking" | "ready";

type DashboardGuardProps = {
  children: React.ReactNode;
};

function getRoleFromPath(pathname: string): Role | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboards") {
    return null;
  }
  const role = parts[1];
  return isRole(role) ? role : null;
}

export default function DashboardGuard({ children }: DashboardGuardProps) {
  const [status, setStatus] = useState<GuardStatus>("checking");
  const router = useRouter();
  const pathname = usePathname();

  const requestedRole = useMemo(() => getRoleFromPath(pathname), [pathname]);

  useEffect(() => {
    let isActive = true;

    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isActive) {
        return;
      }

      const user = data.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      // profiles.role is the source of truth (it is what RLS checks via is_admin()).
      // user_metadata is editable by the user, so it is only a fallback for
      // non-admin roles while a profile row has not been created yet.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      const profileRole = isRole(profile?.role) ? profile.role : undefined;
      const metadataRole = isRole(user.user_metadata?.role)
        ? (user.user_metadata.role as Role)
        : undefined;
      const role: Role | undefined =
        profileRole ?? (metadataRole === "admin" ? undefined : metadataRole);

      if (requestedRole === "admin" && role !== "admin") {
        router.replace(getDashboardRoute(role));
        return;
      }

      if (requestedRole && role && requestedRole !== role) {
        router.replace(getDashboardRoute(role));
        return;
      }

      setStatus("ready");
    };

    checkUser();

    return () => {
      isActive = false;
    };
  }, [router, requestedRole]);

  if (status === "checking") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-300">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
