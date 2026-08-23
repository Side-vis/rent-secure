import DashboardSection from "@/components/dashboards/DashboardSection";

export default function InvestorDashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <h2 className="text-3xl font-semibold text-white">Investor Dashboard</h2>
        <p className="mt-2 text-sm text-slate-300">
          Fund rental loans and monitor portfolio performance.
        </p>
      </div>
      <DashboardSection
        title="Opportunities"
        description="Review tenant loan requests with risk insights."
        items={[
          "Browse loan requests",
          "Review risk assessments",
          "Fund tenant loans",
          "Diversify allocations",
        ]}
      />
      <DashboardSection
        title="Portfolio"
        description="Stay ahead of repayments and returns."
        items={[
          "Monitor repayment status",
          "Track interest earnings",
          "View cash flow timelines",
          "Generate statements",
        ]}
      />
      <DashboardSection
        title="Insights"
        description="Understand performance across your investments."
        items={[
          "Portfolio health overview",
          "Risk exposure alerts",
          "Market opportunity updates",
          "Withdrawal planning",
        ]}
      />
    </div>
  );
}
