"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  XCircle,
} from "lucide-react";

import { supabase } from "@/app/lib/supabase";

type DiagnosticLog = {
  id: string;
  student_code: string | null;
  step: string;
  status: "started" | "success" | "error";
  error_message: string | null;
  request_id: string | null;
  browser: string | null;
  device: string | null;
  created_at: string;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status: DiagnosticLog["status"]) {
  if (status === "success") return "Success";
  if (status === "error") return "Error";
  return "Started";
}

function stepLabel(step: string) {
  const labels: Record<string, string> = {
    page_loaded: "Registration page loaded",
    registration_status_started: "Checking registration status",
    registration_status_success: "Registration status checked",
    registration_status_error: "Registration status failed",

    photo_upload_started: "Student photo upload started",
    photo_upload_success: "Student photo uploaded",
    photo_upload_error: "Student photo upload failed",

    identity_upload_started: "Identity document upload started",
    identity_upload_success: "Identity document uploaded",
    identity_upload_error: "Identity document upload failed",

    continue_started: "Continue button pressed",
    continue_success: "Moved to group selection",
    continue_error: "Continue failed",

    confirmation_page_loaded: "Confirmation page loaded",
    confirm_registration_started: "Registration confirmation started",
    confirm_registration_success: "Registration confirmed",
    confirm_registration_error: "Registration confirmation failed",

    unexpected_error: "Unexpected error",
  };

  return labels[step] || step.replaceAll("_", " ");
}

function StatusIcon({ status }: { status: DiagnosticLog["status"] }) {
  if (status === "success") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={18} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <XCircle size={18} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
      <Clock3 size={18} />
    </div>
  );
}

export default function RegistrationDiagnosticsPage() {
  const [studentCode, setStudentCode] = useState("");
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const loadLogs = useCallback(async (code?: string) => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be signed in as an administrator.");
      }

      const searchCode = (code ?? studentCode).trim();

      const { data, error: logsError } = await supabase.rpc(
        "get_intern_registration_logs",
        {
          p_student_code: searchCode || null,
          p_limit: 500,
        },
      );

      if (logsError) {
        throw new Error(logsError.message);
      }

      setLogs((data ?? []) as DiagnosticLog[]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load registration diagnostics.";

      setError(message);
      setLogs([]);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [studentCode]);

  useEffect(() => {
    void loadLogs("");
  }, [loadLogs]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSearched(true);
    await loadLogs(studentCode);
  };

  const handleClear = async () => {
    setStudentCode("");
    setSearched(false);
    await loadLogs("");
  };

  const statistics = useMemo(() => {
    const success = logs.filter((log) => log.status === "success").length;
    const errors = logs.filter((log) => log.status === "error").length;
    const started = logs.filter((log) => log.status === "started").length;

    return {
      total: logs.length,
      success,
      errors,
      started,
    };
  }, [logs]);

  const groupedByStudent = useMemo(() => {
    const map = new Map<string, number>();

    for (const log of logs) {
      const code = log.student_code || "Unknown";
      map.set(code, (map.get(code) || 0) + 1);
    }

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              <ArrowLeft size={16} />
              Back to Admin
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                  Registration Diagnostics
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Monitor registration attempts and identify where students
                  encounter problems.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadLogs(studentCode)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value)}
                placeholder="Search by Student Code"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search size={16} />
              Search
            </button>

            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={loading && !studentCode}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Show All
            </button>
          </form>
        </section>

        {error && (
          <section className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load diagnostics</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </section>
        )}

        {!initialLoading && !error && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Total Events
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {statistics.total}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Successful
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-600">
                  {statistics.success}
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Errors</p>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {statistics.errors}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Started
                </p>
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {statistics.started}
                </p>
              </div>
            </section>

            {searched && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <UserRound size={20} className="text-slate-500" />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Search
                    </p>

                    <p className="font-semibold text-slate-950">
                      {studentCode.trim() || "All students"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!searched && groupedByStudent.length > 0 && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-950">
                    Recent Student Activity
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Search for a Student Code to inspect one registration
                    attempt in detail.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groupedByStudent.slice(0, 12).map(([code, count]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setStudentCode(code);
                        setSearched(true);
                        void loadLogs(code);
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="font-semibold text-slate-900">{code}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {count} event{count === 1 ? "" : "s"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-950">
                  Registration Timeline
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {searched
                    ? `Showing ${logs.length} event${
                        logs.length === 1 ? "" : "s"
                      } for ${studentCode.trim() || "all students"}.`
                    : `Showing the latest ${logs.length} diagnostic event${
                        logs.length === 1 ? "" : "s"
                      }.`}
                </p>
              </div>

              {logs.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Search size={20} />
                  </div>

                  <h3 className="mt-4 font-semibold text-slate-900">
                    No diagnostic events found
                  </h3>

                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    No logs match the current search. Make sure the Student
                    Code is correct and that the student has already opened
                    or used the registration system.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <article
                      key={log.id}
                      className="px-5 py-5 transition hover:bg-slate-50/70"
                    >
                      <div className="flex items-start gap-4">
                        <StatusIcon status={log.status} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-slate-950">
                                  {stepLabel(log.step)}
                                </h3>

                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    log.status === "success"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : log.status === "error"
                                        ? "bg-red-50 text-red-700"
                                        : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {statusLabel(log.status)}
                                </span>
                              </div>

                              <p className="mt-1 text-sm text-slate-500">
                                {formatDate(log.created_at)}
                              </p>
                            </div>

                            {log.student_code && (
                              <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                                Student: {log.student_code}
                              </div>
                            )}
                          </div>

                          {log.error_message && (
                            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3">
                              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                                Error
                              </p>

                              <p className="mt-1 break-words text-sm text-red-800">
                                {log.error_message}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {log.browser && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-medium text-slate-400">
                                  Browser
                                </p>

                                <p className="mt-1 break-words text-sm font-medium text-slate-700">
                                  {log.browser}
                                </p>
                              </div>
                            )}

                            {log.device && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <div className="flex items-center gap-1.5">
                                  <Smartphone
                                    size={14}
                                    className="text-slate-400"
                                  />

                                  <p className="text-xs font-medium text-slate-400">
                                    Device
                                  </p>
                                </div>

                                <p className="mt-1 break-words text-sm font-medium text-slate-700">
                                  {log.device}
                                </p>
                              </div>
                            )}

                            {log.request_id && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-medium text-slate-400">
                                  Request ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs text-slate-600">
                                  {log.request_id}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {initialLoading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <RefreshCw
              size={24}
              className="mx-auto animate-spin text-slate-400"
            />

            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading registration diagnostics...
            </p>
          </section>
        )}
      </div>
    </main>
  );
}