"use client";

import FadeIn from "@/components/motion/FadeIn";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const steps = [
  { title: "Discover", icon: "D" },
  { title: "Trust", icon: "T" },
  { title: "Pay", icon: "P" },
  { title: "Grow", icon: "G" },
];

const audiences = [
  { title: "Tenants", phrase: "Rent without fear" },
  { title: "Landlords", phrase: "Screen with confidence" },
  { title: "Investors", phrase: "Fund trusted rent" },
];

const entryPoints = [
  {
    title: "Tenant entry",
    subtitle: "Search verified homes and manage rent in one place.",
    href: "/auth",
    cta: "I am a tenant",
    accent: "#06b6d4",
  },
  {
    title: "Landlord entry",
    subtitle: "Onboard your portfolio and invite tenants quickly.",
    href: "/auth/landlord",
    cta: "I am a landlord",
    accent: "#10b981",
  },
];

const benefits = [
  "Secure",
  "Transparent",
  "Rewards",
  "Fast",
  "Verified",
  "Simple",
  "Automated",
  "Insightful",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl" />
          <div className="absolute bottom-0 left-16 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
        </div>

        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-20">
          <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <FadeIn>
              <div className="flex flex-col gap-6">
                <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
                  RentSecure
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                  Trust, proven.
                </h1>
                <p className="max-w-xl text-base text-slate-600">
                  A trusted rental network for tenants, landlords, and
                  investors.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {entryPoints.map((entry) => (
                    <Link
                      key={entry.title}
                      href={entry.href}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {entry.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {entry.subtitle}
                          </p>
                        </div>
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.accent }}
                        />
                      </div>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition group-hover:text-slate-900">
                        {entry.cta}
                      </p>
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth"
                    className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2"
                  >
                    All roles sign in
                  </Link>
                  <span className="text-xs text-slate-500">
                    Tenant and landlord access starts here
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <TrustPill label="Verified" />
                  <TrustPill label="Secure payments" />
                  <TrustPill label="On-time streak" />
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <ScoreCard value={824} label="Excellent" />
                  <StatCard label="On-time streak" value="12m" />
                </div>
                <div className="grid gap-3">
                  <PropertyCard
                    title="Kololo Court Apartments"
                    meta="UGX 2,140,000 / mo"
                    badge="Verified"
                  />
                  <PropertyCard
                    title="Naalya Garden Residences"
                    meta="UGX 1,860,000 / mo"
                    badge="Trusted"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                  <Badge label="On-time" />
                  <Badge label="Verified" />
                  <Badge label="Trusted" />
                </div>
              </div>
            </FadeIn>
          </section>

          <section className="grid gap-8">
            <SectionHeader title="How it works" />
            <div className="grid gap-4 md:grid-cols-4">
              {steps.map((step, index) => (
                <MotionCard key={step.title} delay={0.05 * index}>
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                      {step.icon}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {step.title}
                    </span>
                  </div>
                </MotionCard>
              ))}
            </div>
          </section>

          <section className="grid gap-8">
            <SectionHeader title="Who it is for" />
            <div className="grid gap-4 md:grid-cols-3">
              {audiences.map((audience) => (
                <MotionCard key={audience.title}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      {audience.title.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {audience.title}
                      </p>
                      <p className="text-xs text-slate-500">{audience.phrase}</p>
                    </div>
                  </div>
                </MotionCard>
              ))}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <FadeIn>
              <div className="grid gap-4">
                <SectionHeader title="Trust + scoring" />
                <div className="grid gap-3">
                  <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>RentSecure score</span>
                      <span>824</span>
                    </div>
                    <ScoreGauge value={82} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge label="On-time" />
                    <Badge label="Verified" />
                    <Badge label="Trusted" />
                  </div>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="grid gap-4">
                <MotionCard>
                  <p className="text-lg font-semibold text-slate-900">
                    Pay on time. Get rewarded.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Trust unlocks better rental terms and funding access.
                  </p>
                </MotionCard>
                <MotionCard>
                  <p className="text-lg font-semibold text-slate-900">
                    Rent without fear.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Verified listings and transparent history.
                  </p>
                </MotionCard>
              </div>
            </FadeIn>
          </section>

          <section className="grid gap-8">
            <SectionHeader title="Benefits" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit, index) => (
                <MotionCard key={benefit} delay={0.03 * index}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                      {benefit.slice(0, 1)}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {benefit}
                    </span>
                  </div>
                </MotionCard>
              ))}
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-xl shadow-slate-200/70">
            <FadeIn>
              <h2 className="text-3xl font-semibold text-slate-900">
                Rent with clarity.
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Simple, trusted, and built for every role.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth"
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Get Started
                </Link>
                <Link
                  href="/dashboards/tenant"
                  className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                >
                  Explore Rentals
                </Link>
              </div>
            </FadeIn>
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
        {title}
      </h2>
      <div className="h-px w-16 bg-slate-200" />
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
      {label}
    </span>
  );
}

function TrustPill({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ScoreCard({ value, label }: { value: number; label: string }) {
  const count = useCountUp(value, 900);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(#0f172a ${count * 0.36}deg, #e2e8f0 0deg)`,
          }}
        />
        <div className="absolute inset-1 rounded-full bg-slate-50" />
        <div className="relative text-sm font-semibold text-slate-900">
          {count}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          RentSecure Score
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{label}</p>
      </div>
    </div>
  );
}

function PropertyCard({
  title,
  meta,
  badge,
}: {
  title: string;
  meta: string;
  badge: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const angle = Math.min(Math.max(value, 0), 100) * 1.8;
  return (
    <div className="relative flex items-center justify-center">
      <div
        className="h-40 w-40 rounded-full"
        style={{
          background: `conic-gradient(#0f172a ${angle}deg, #e2e8f0 0deg)`,
          maskImage: "radial-gradient(circle 64px at center, transparent 58%, black 60%)",
          WebkitMaskImage:
            "radial-gradient(circle 64px at center, transparent 58%, black 60%)",
        }}
      />
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Score
        </span>
      </div>
    </div>
  );
}

function MotionCard({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      whileHover={{ y: -4 }}
    >
      {children}
    </motion.div>
  );
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const nextValue = Math.round(progress * target);
      setValue(nextValue);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target]);

  return value;
}
