"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Users,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <GraduationCap size={23} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">
                Internship Registration
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Intern Rotation System
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
            <Users size={17} />
            <span>Internship Batch</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pb-10 pt-12 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-[2rem] bg-slate-900 px-7 py-10 text-white shadow-xl md:px-12 md:py-14">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                <CalendarDays size={17} />
                Internship Rotation Registration
              </div>

              <h2 className="text-4xl font-bold leading-tight md:text-6xl">
                Choose your internship rotation
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Complete your student information, choose your Bundle and
                Group, review your rotation schedule, and confirm your
                internship registration.
              </p>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-6 py-4 font-semibold text-white transition hover:bg-cyan-400"
                >
                  Start Registration
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
              How it works
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              Registration process
            </h3>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <StepCard
              number="01"
              icon={<ClipboardList size={22} />}
              title="Enter your information"
              description="Enter your full name, student code, phone number, GPA, nationality, national ID, and passport number."
            />

            <StepCard
              number="02"
              icon={<Users size={22} />}
              title="Choose your Group"
              description="Select one of the available Bundles and Groups according to the available capacity."
            />

            <StepCard
              number="03"
              icon={<CheckCircle2 size={22} />}
              title="Confirm registration"
              description="Review your selected rotation schedule, then confirm your registration and receive your registration number."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

type StepCardProps = {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function StepCard({
  number,
  icon,
  title,
  description,
}: StepCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
          {icon}
        </div>

        <span className="text-sm font-bold text-slate-300">
          {number}
        </span>
      </div>

      <h4 className="mt-6 text-xl font-bold text-slate-900">
        {title}
      </h4>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}