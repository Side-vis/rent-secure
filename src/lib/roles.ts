export const dashboardRoles = ["tenant", "landlord", "investor", "admin"] as const;

export type Role = (typeof dashboardRoles)[number];

export const DASHBOARD_ROUTES: Record<Role, string> = {
  tenant: "/dashboards/tenant",
  landlord: "/dashboards/landlord",
  investor: "/dashboards/investor",
  admin: "/dashboards/admin",
};

export function isRole(value: string | undefined | null): value is Role {
  return !!value && (dashboardRoles as readonly string[]).includes(value);
}

export function getDashboardRoute(role: string | undefined | null) {
  return isRole(role) ? DASHBOARD_ROUTES[role] : "/landing";
}
