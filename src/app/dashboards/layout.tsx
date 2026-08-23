import DashboardGuard from "@/components/auth/DashboardGuard";
import DashboardNav from "@/components/dashboards/DashboardNav";
import { DashboardThemeProvider } from "@/components/dashboards/DashboardThemeProvider";

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGuard>
      <DashboardThemeProvider>
        <DashboardNav />
        <main className="mx-auto w-full max-w-6xl px-6 py-10">
          {children}
        </main>
      </DashboardThemeProvider>
    </DashboardGuard>
  );
}
