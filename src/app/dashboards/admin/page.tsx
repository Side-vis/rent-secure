import Link from "next/link";
import DashboardSection from "@/components/dashboards/DashboardSection";

export default function AdminDashboardPage() {
  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-slate-900 bg-gradient-to-br from-slate-900/70 via-slate-950/70 to-slate-900/30 p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Control Center
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Admin Dashboard
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              Oversee verification, compliance, and platform health with a
              real-time pulse on activity.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboards/admin/landlords"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Review Landlords
            </Link>
            <Link
              href="/dashboards/admin/listings-verification"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Verify Listings
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pending approvals", value: "12", trend: "Today" },
          { label: "Open disputes", value: "4", trend: "Escalated" },
          { label: "Risk alerts", value: "7", trend: "High priority" },
          { label: "Support backlog", value: "19", trend: "Under SLA" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {item.label}
            </p>
            <div className="mt-3 text-3xl font-semibold text-white">
              {item.value}
            </div>
            <p className="mt-2 text-xs text-slate-500">{item.trend}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-white">Priority Queue</h3>
          <p className="mt-2 text-sm text-slate-300">
            Items requiring admin attention this week.
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-slate-200">
            {[
              "Landlord verification documents pending review",
              "Two high-risk tenant disputes awaiting resolution",
              "Payment anomaly flagged in last settlement batch",
              "Policy update announcement for regulatory compliance",
            ].map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6">
          <DashboardSection
            title="Verification"
            description="Maintain trust across users and listings."
            items={[
              "Verify user identities",
              "Review property listings",
              "Monitor fraud alerts",
              "Audit account changes",
            ]}
          />
          <DashboardSection
            title="Dispute + Support"
            description="Resolve conflicts and support escalations."
            items={[
              "Manage disputes",
              "Support ticket queues",
              "Issue compliance notices",
              "Track SLA performance",
            ]}
          />
        </div>
      </div>

      <DashboardSection
        title="Analytics"
        description="Track platform usage and financial integrity."
        items={[
          "Usage analytics",
          "Payment monitoring",
          "Risk reporting",
          "Marketing insights",
        ]}
      />
    </div>
  );
}
