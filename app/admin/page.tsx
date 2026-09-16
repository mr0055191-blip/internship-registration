"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  GraduationCap,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/supabase";

type Bundle = {
  id: string;
  name: string;
  code: string;
};

type Group = {
  id: string;
  bundle_id: string;
  name: string;
  code: string;
  capacity: number;
  is_active: boolean;
};

type Registration = {
  id: string;
  student_id: string;
  group_id: string;
  registration_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  student: {
    id: string;
    full_name: string;
    student_code: string;
    phone: string | null;
    gpa: number | null;
    nationality: string | null;
    national_id: string | null;
    passport_number: string | null;
    batch: string | null;
    student_photo_url: string | null;
    identity_document_url: string | null;
  } | null;
  group: {
    id: string;
    name: string;
    code: string;
    capacity: number;
    is_active: boolean;
    bundle_id: string;
    bundle: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
};

type SettingsData = {
  registration_open: boolean;
  registration_closes_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function AdminPage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupCapacity, setGroupCapacity] = useState("");
  const [groupActive, setGroupActive] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);

  const [editingStudent, setEditingStudent] =
    useState<Registration | null>(null);

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    studentCode: "",
    phone: "",
    gpa: "",
    nationality: "",
    nationalId: "",
    passportNumber: "",
    batch: "",
  });

  const [savingStudent, setSavingStudent] = useState(false);

  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");

  const [savingSettings, setSavingSettings] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data.user) {
        setUserEmail(null);
      } else {
        setUserEmail(data.user.email ?? null);
      }

      setSessionLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;

      setUserEmail(currentSession?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadAdminData() {
    setLoadingData(true);
    setDataError("");

    try {
      const [
        registrationsResult,
        studentsResult,
        groupsResult,
        bundlesResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("intern_registrations")
          .select(
            `
              id,
              student_id,
              group_id,
              registration_number,
              status,
              created_at,
              updated_at
            `,
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("intern_students")
          .select(
            `
              id,
              full_name,
              student_code,
              phone,
              gpa,
              nationality,
              national_id,
              passport_number,
              batch,
              student_photo_url,
              identity_document_url
            `,
          ),

        supabase
          .from("intern_groups")
          .select(
            `
              id,
              bundle_id,
              name,
              code,
              capacity,
              is_active
            `,
          )
          .order("code", { ascending: true }),

        supabase
          .from("intern_bundles")
          .select(
            `
              id,
              name,
              code
            `,
          )
          .order("created_at", { ascending: true }),

        supabase
          .from("internship_settings")
          .select(
            `
              registration_open,
              registration_closes_at
            `,
          )
          .limit(1)
          .maybeSingle(),
      ]);

      if (registrationsResult.error) {
        throw new Error(
          `Registrations: ${registrationsResult.error.message}`,
        );
      }

      if (studentsResult.error) {
        throw new Error(`Students: ${studentsResult.error.message}`);
      }

      if (groupsResult.error) {
        throw new Error(`Groups: ${groupsResult.error.message}`);
      }

      if (bundlesResult.error) {
        throw new Error(`Bundles: ${bundlesResult.error.message}`);
      }

      if (settingsResult.error) {
        throw new Error(`Settings: ${settingsResult.error.message}`);
      }

      const registrationRows = registrationsResult.data ?? [];
      const studentRows = studentsResult.data ?? [];
      const groupRows = groupsResult.data ?? [];
      const bundleRows = bundlesResult.data ?? [];

      const studentsMap = new Map(
        studentRows.map((student) => [student.id, student]),
      );

      const bundlesMap = new Map(
        bundleRows.map((bundle) => [bundle.id, bundle]),
      );

      const groupsMap = new Map(
        groupRows.map((group) => [group.id, group]),
      );

      const combined: Registration[] = registrationRows.map((registration) => {
        const student = studentsMap.get(registration.student_id) ?? null;
        const rawGroup = groupsMap.get(registration.group_id) ?? null;

        const group = rawGroup
          ? {
              ...rawGroup,
              bundle: bundlesMap.get(rawGroup.bundle_id) ?? null,
            }
          : null;

        return {
          ...registration,
          student,
          group,
        };
      });

      setRegistrations(combined);

      setBundles(bundleRows);
      setGroups(groupRows);

      const currentSettings = settingsResult.data;

      if (currentSettings) {
        setSettings(currentSettings);
        setRegistrationOpen(currentSettings.registration_open);
        setRegistrationClosesAt(
          currentSettings.registration_closes_at
            ? new Date(currentSettings.registration_closes_at)
                .toISOString()
                .slice(0, 16)
            : "",
        );
      }
    } catch (error) {
      console.error("Admin data loading error:", error);

      setDataError(
        error instanceof Error
          ? error.message
          : "Failed to load admin data.",
      );
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!userEmail) return;

    loadAdminData();
  }, [userEmail]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setLoginLoading(true);
    setLoginError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoginLoading(false);

    if (error) {
      setLoginError(error.message);
      return;
    }

    setUserEmail(data.user?.email ?? email.trim());
    setPassword("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setRegistrations([]);
  }
  function handleExportExcel() {
    if (registrations.length === 0) {
      alert("There are no registrations to export.");
      return;
    }

    const exportData = registrations.map((registration, index) => {
      const student = registration.student;
      const group = registration.group;

      return {
        "#": index + 1,

        "Registration Number":
          registration.registration_number,

        "Registration ID":
          registration.id,

        "Registration Status":
          registration.status,

        "Registration Date":
          formatDate(registration.created_at),

        "Last Updated":
          formatDate(registration.updated_at),

        "Full Name":
          student?.full_name ?? "",

        "Student Code":
          student?.student_code ?? "",

        "Phone":
          student?.phone ?? "",

        "GPA":
          student?.gpa ?? "",

        "Nationality":
          student?.nationality ?? "",

        "National ID":
          student?.national_id ?? "",

        "Passport Number":
          student?.passport_number ?? "",

        "Batch":
          student?.batch ?? "",

        "Bundle":
          group?.bundle?.name ?? "",

        "Bundle Code":
          group?.bundle?.code ?? "",

        "Group":
          group?.name ?? "",

        "Group Code":
          group?.code ?? "",

        "Group Capacity":
          group?.capacity ?? "",

        "Group Active":
          group?.is_active ? "Yes" : "No",

        "Student Photo":
          student?.student_photo_url ?? "",

        "Identity Document":
          student?.identity_document_url ?? "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 38 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 45 },
      { wch: 45 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Registrations",
    );

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    XLSX.writeFile(
      workbook,
      `internship-registrations-${today}.xlsx`,
    );
  }
  async function saveSettings() {
    setSavingSettings(true);
    setDataError("");

    try {
      const closeValue = registrationClosesAt
        ? new Date(registrationClosesAt).toISOString()
        : null;

      const { error } = await supabase.rpc(
        "admin_update_internship_settings",
        {
          p_registration_open: registrationOpen,
          p_registration_closes_at: closeValue,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      await loadAdminData();
    } catch (error) {
      console.error(error);

      setDataError(
        error instanceof Error
          ? error.message
          : "Failed to update registration settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  function openGroupEditor(group: Group) {
    setEditingGroup(group);
    setGroupCapacity(String(group.capacity));
    setGroupActive(group.is_active);
  }

  async function saveGroup() {
    if (!editingGroup) return;

    const capacity = Number(groupCapacity);

    if (!Number.isInteger(capacity) || capacity < 1) {
      alert("Capacity must be a positive whole number.");
      return;
    }

    setSavingGroup(true);
    setDataError("");

    try {
      const { error } = await supabase.rpc("admin_update_intern_group", {
        p_group_id: editingGroup.id,
        p_name: editingGroup.name,
        p_code: editingGroup.code,
        p_capacity: capacity,
        p_is_active: groupActive,
      });

      if (error) {
        throw new Error(error.message);
      }

      setEditingGroup(null);
      await loadAdminData();
    } catch (error) {
      console.error(error);

      setDataError(
        error instanceof Error
          ? error.message
          : "Failed to update group.",
      );
    } finally {
      setSavingGroup(false);
    }
  }

  function openStudentEditor(registration: Registration) {
    if (!registration.student) return;

    setEditingStudent(registration);

    setStudentForm({
      fullName: registration.student.full_name ?? "",
      studentCode: registration.student.student_code ?? "",
      phone: registration.student.phone ?? "",
      gpa:
        registration.student.gpa === null ||
        registration.student.gpa === undefined
          ? ""
          : String(registration.student.gpa),
      nationality: registration.student.nationality ?? "",
      nationalId: registration.student.national_id ?? "",
      passportNumber: registration.student.passport_number ?? "",
      batch: registration.student.batch ?? "",
    });
  }

  async function saveStudent() {
    if (!editingStudent?.student) return;

    setSavingStudent(true);
    setDataError("");

    try {
      const { error } = await supabase
        .from("intern_students")
        .update({
          full_name: studentForm.fullName.trim(),
          student_code: studentForm.studentCode.trim(),
          phone: studentForm.phone.trim() || null,
          gpa:
            studentForm.gpa.trim() === ""
              ? null
              : Number(studentForm.gpa),
          nationality: studentForm.nationality.trim() || null,
          national_id: studentForm.nationalId.trim() || null,
          passport_number:
            studentForm.passportNumber.trim() || null,
          batch: studentForm.batch.trim() || null,
        })
        .eq("id", editingStudent.student.id);

      if (error) {
        throw new Error(error.message);
      }

      setEditingStudent(null);
      await loadAdminData();
    } catch (error) {
      console.error(error);

      setDataError(
        error instanceof Error
          ? error.message
          : "Failed to update student.",
      );
    } finally {
      setSavingStudent(false);
    }
  }

  async function deleteRegistration(registration: Registration) {
    const studentName =
      registration.student?.full_name ||
      registration.registration_number;

    const confirmed = window.confirm(
      `Delete registration for ${studentName}?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(registration.id);
    setDataError("");

    try {
      const { error } = await supabase
        .from("intern_registrations")
        .delete()
        .eq("id", registration.id);

      if (error) {
        throw new Error(error.message);
      }

      await loadAdminData();
    } catch (error) {
      console.error(error);

      setDataError(
        error instanceof Error
          ? error.message
          : "Failed to delete registration.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredRegistrations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return registrations;

    return registrations.filter((registration) => {
      const student = registration.student;
      const group = registration.group;

      const values = [
        registration.registration_number,
        registration.status,
        student?.full_name,
        student?.student_code,
        student?.phone,
        student?.national_id,
        student?.passport_number,
        student?.batch,
        student?.nationality,
        group?.name,
        group?.code,
        group?.bundle?.name,
        group?.bundle?.code,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [registrations, searchTerm]);

  const confirmedCount = useMemo(
    () =>
      registrations.filter(
        (registration) => registration.status === "confirmed",
      ).length,
    [registrations],
  );

  const pendingCount = useMemo(
    () =>
      registrations.filter(
        (registration) => registration.status === "pending",
      ).length,
    [registrations],
  );

  const activeGroupsCount = useMemo(
    () => groups.filter((group) => group.is_active).length,
    [groups],
  );

  const totalCapacity = useMemo(
    () =>
      groups
        .filter((group) => group.is_active)
        .reduce((sum, group) => sum + Number(group.capacity || 0), 0),
    [groups],
  );

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading admin...
        </div>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <form
            onSubmit={handleLogin}
            className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <ShieldCheck className="h-8 w-8" />
              </div>

              <h1 className="text-2xl font-bold">
                Internship Admin
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Sign in to manage internship registrations.
              </p>
            </div>

            {loginError && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {loginError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Sign in
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <GraduationCap className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  Internship Administration
                </h1>

                <p className="text-sm text-slate-400">
                  Manage students, groups and registration settings.
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Logged in as {userEmail}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/diagnostics"
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-300 transition hover:bg-violet-500/20"
            >
              <ShieldCheck className="h-4 w-4" />
              Registration Diagnostics
            </Link>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={registrations.length === 0}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Export Excel
            </button>

            <button
              type="button"
              onClick={loadAdminData}
              disabled={loadingData}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-medium transition hover:border-cyan-500 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loadingData ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        {dataError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="text-sm">
              <p className="font-semibold">Error</p>
              <p className="mt-1">{dataError}</p>
            </div>
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <Users className="h-6 w-6 text-cyan-400" />
              <span className="text-xs text-slate-500">
                Total
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {registrations.length}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Registrations
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <span className="text-xs text-slate-500">
                Confirmed
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {confirmedCount}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Confirmed registrations
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <Clock3 className="h-6 w-6 text-amber-400" />
              <span className="text-xs text-slate-500">
                Pending
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {pendingCount}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Pending registrations
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <Settings className="h-6 w-6 text-violet-400" />
              <span className="text-xs text-slate-500">
                Capacity
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {totalCapacity}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              {activeGroupsCount} active groups
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Settings className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold">
                Registration Settings
              </h2>

              <p className="text-sm text-slate-400">
                Open or close student registration.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3 lg:items-end">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Registration status
              </label>

              <button
                type="button"
                onClick={() =>
                  setRegistrationOpen((current) => !current)
                }
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${
                  registrationOpen
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
              >
                <span className="font-medium">
                  {registrationOpen ? "Open" : "Closed"}
                </span>

                {registrationOpen ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Close date & time
              </label>

              <input
                type="datetime-local"
                value={registrationClosesAt}
                onChange={(event) =>
                  setRegistrationClosesAt(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>

          {settings?.registration_closes_at && (
            <p className="mt-4 text-xs text-slate-500">
              Current close time:{" "}
              {formatDate(settings.registration_closes_at)}
            </p>
          )}
        </section>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              Bundles & Groups
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Manage capacity and availability of existing groups.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {bundles.map((bundle) => {
              const bundleGroups = groups.filter(
                (group) => group.bundle_id === bundle.id,
              );

              return (
                <div
                  key={bundle.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">
                        {bundle.name}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {bundle.code}
                      </p>
                    </div>

                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                      {bundleGroups.length} groups
                    </span>
                  </div>

                  <div className="space-y-3">
                    {bundleGroups.map((group) => {
                      const confirmedInGroup =
                        registrations.filter(
                          (registration) =>
                            registration.group_id === group.id &&
                            registration.status === "confirmed",
                        ).length;

                      const availableSeats = Math.max(
                        Number(group.capacity) -
                          confirmedInGroup,
                        0,
                      );

                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">
                                  {group.name}
                                </span>

                                <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">
                                  {group.code}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
                                  Capacity: {group.capacity}
                                </span>

                                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
                                  Registered: {confirmedInGroup}
                                </span>

                                <span
                                  className={`rounded-full px-2.5 py-1 ${
                                    availableSeats > 0
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : "bg-red-500/10 text-red-300"
                                  }`}
                                >
                                  Available: {availableSeats}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs ${
                                  group.is_active
                                    ? "bg-emerald-500/10 text-emerald-300"
                                    : "bg-red-500/10 text-red-300"
                                }`}
                              >
                                {group.is_active
                                  ? "Active"
                                  : "Closed"}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  openGroupEditor(group)
                                }
                                className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm transition hover:border-cyan-500 hover:text-cyan-300"
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Student Registrations
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Showing {filteredRegistrations.length} of{" "}
                {registrations.length} registrations.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search name, student code, registration number..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {loadingData && registrations.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Loading registrations...
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-600" />

              <p className="mt-4 font-medium text-slate-300">
                No registrations found.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try refreshing or changing the search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="min-w-[1250px] w-full text-left">
                <thead className="bg-slate-950">
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-4">
                      Registration
                    </th>
                    <th className="px-4 py-4">
                      Student
                    </th>
                    <th className="px-4 py-4">
                      Contact
                    </th>
                    <th className="px-4 py-4">
                      Identity
                    </th>
                    <th className="px-4 py-4">
                      Batch
                    </th>
                    <th className="px-4 py-4">
                      Group
                    </th>
                    <th className="px-4 py-4">
                      Status
                    </th>
                    <th className="px-4 py-4">
                      Registered At
                    </th>
                    <th className="px-4 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRegistrations.map((registration) => {
                    const student = registration.student;
                    const group = registration.group;

                    return (
                      <tr
                        key={registration.id}
                        className="border-b border-slate-800/80 align-top transition hover:bg-slate-800/30"
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-cyan-300">
                            {registration.registration_number}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {registration.id}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">
                            {student?.full_name || "Student unavailable"}
                          </div>

                          <div className="mt-1 text-sm text-slate-400">
                            {student?.student_code || "—"}
                          </div>

                          {student?.gpa !== null &&
                            student?.gpa !== undefined && (
                              <div className="mt-1 text-xs text-slate-500">
                                GPA: {student.gpa}
                              </div>
                            )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-300">
                            {student?.phone || "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {student?.nationality || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="max-w-[190px] text-sm text-slate-300">
                            {student?.national_id ||
                              student?.passport_number ||
                              "—"}
                          </div>

                          <div className="mt-2 flex gap-2">
                            {student?.student_photo_url && (
                              <a
                                href={student.student_photo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-cyan-300 hover:border-cyan-500"
                              >
                                Photo
                              </a>
                            )}

                            {student?.identity_document_url && (
                              <a
                                href={student.identity_document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-cyan-300 hover:border-cyan-500"
                              >
                                <FileText className="h-3 w-3" />
                                ID
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                            {student?.batch || "—"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {group ? (
                            <>
                              <div className="font-medium text-white">
                                {group.bundle?.name || "—"}
                              </div>

                              <div className="mt-1 text-sm text-cyan-300">
                                {group.name} ({group.code})
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                              registration.status ===
                              "confirmed"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : registration.status ===
                                    "pending"
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {registration.status ===
                            "confirmed" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Clock3 className="h-3.5 w-3.5" />
                            )}

                            {registration.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-400">
                          {formatDate(registration.created_at)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openStudentEditor(registration)
                              }
                              disabled={!student}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteRegistration(registration)
                              }
                              disabled={
                                deletingId === registration.id
                              }
                              className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                            >
                              {deletingId === registration.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Edit Group
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {editingGroup.name} ({editingGroup.code})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Capacity
                </label>

                <input
                  type="number"
                  min="1"
                  value={groupCapacity}
                  onChange={(event) =>
                    setGroupCapacity(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  <p className="font-medium">
                    Group active
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Students can select this group when active.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={groupActive}
                  onChange={(event) =>
                    setGroupActive(event.target.checked)
                  }
                  className="h-5 w-5 accent-cyan-500"
                />
              </label>

              <button
                type="button"
                onClick={saveGroup}
                disabled={savingGroup}
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {savingGroup ? "Saving..." : "Save Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Edit Student
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Update student information.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm text-slate-300">
                  Full name
                </label>

                <input
                  value={studentForm.fullName}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Student code
                </label>

                <input
                  value={studentForm.studentCode}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      studentCode: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Phone
                </label>

                <input
                  value={studentForm.phone}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  GPA
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  value={studentForm.gpa}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      gpa: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Batch
                </label>

                <input
                  value={studentForm.batch}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      batch: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Nationality
                </label>

                <input
                  value={studentForm.nationality}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      nationality: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  National ID
                </label>

                <input
                  value={studentForm.nationalId}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      nationalId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Passport number
                </label>

                <input
                  value={studentForm.passportNumber}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      passportNumber: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveStudent}
                disabled={savingStudent}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {savingStudent ? "Saving..." : "Save Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}