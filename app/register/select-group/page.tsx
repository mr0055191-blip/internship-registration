"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";

import { supabase } from "@/app/lib/supabase";

type StudentData = {
  fullName: string;
  studentCode: string;
  phone: string;
  gpa: number;
  nationality: string;
  nationalityType: "Egyptian" | "Other" | "";
  nationalId: string;
  passportNumber: string;
  batch: string;
  studentPhotoUrl: string;
  identityDocumentUrl: string;
};

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

type Rotation = {
  id: string;
  group_id: string;
  rotation_date: string;
  department: string;
};

type GroupWithCount = Group & {
  registeredCount: number;
  availableSeats: number;
  isFull: boolean;
};

const ACADEMIC_ROTATION_DATES = [
  "1/11",
  "1/12",
  "1/1",
  "1/2",
  "1/3",
  "1/4",
  "1/5",
  "1/6",
  "1/7",
  "1/8",
  "1/9",
  "1/10",
] as const;

const rotationDateOrder = new Map<string, number>(
  ACADEMIC_ROTATION_DATES.map((date, index) => [
    date,
    index,
  ] as const),
);

function sortRotations(rotations: Rotation[]) {
  return [...rotations].sort((first, second) => {
    const firstOrder =
      rotationDateOrder.get(first.rotation_date.trim()) ??
      Number.MAX_SAFE_INTEGER;

    const secondOrder =
      rotationDateOrder.get(second.rotation_date.trim()) ??
      Number.MAX_SAFE_INTEGER;

    return (
      firstOrder - secondOrder ||
      first.rotation_date.localeCompare(second.rotation_date)
    );
  });
}

function formatRotationDate(dateString: string) {
  const date = dateString.trim();
  const order = rotationDateOrder.get(date);

  if (order === undefined) {
    return dateString || "—";
  }

  return `${date}/${order < 2 ? "2026" : "2027"}`;
}

export default function SelectGroupPage() {
  const [student, setStudent] =
    useState<StudentData | null>(null);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);

  const [selectedBundleId, setSelectedBundleId] =
    useState<string>("");

  const [selectedGroupId, setSelectedGroupId] =
    useState<string>("");

  const [registrationCounts, setRegistrationCounts] =
    useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] =
    useState(false);

  const [checkingStatus, setCheckingStatus] =
    useState(true);

  const [registrationOpen, setRegistrationOpen] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const storedStudent = sessionStorage.getItem(
      "internship_student_data",
    );

    if (!storedStudent) {
      window.location.href = "/register";
      return;
    }

    try {
      const parsedStudent = JSON.parse(
        storedStudent,
      ) as StudentData;

      setStudent(parsedStudent);
    } catch (storageError) {
      console.error(storageError);

      sessionStorage.removeItem(
        "internship_student_data",
      );

      window.location.href = "/register";
    }
  }, []);

  useEffect(() => {
    async function checkRegistrationStatus() {
      setCheckingStatus(true);

      const { data, error: statusError } =
        await supabase.rpc(
          "get_internship_registration_status",
        );

      if (statusError) {
        console.error(statusError);

        /*
         * The final submit_intern_registration RPC
         * performs the real security check as well.
         */
        setRegistrationOpen(true);
        setCheckingStatus(false);
        return;
      }

      const statusRow = Array.isArray(data)
        ? data[0]
        : data;

      setRegistrationOpen(
        statusRow?.registration_open !== false,
      );

      setCheckingStatus(false);
    }

    checkRegistrationStatus();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!registrationOpen) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [
        { data: bundlesData, error: bundlesError },
        { data: groupsData, error: groupsError },
        { data: registrationsData, error: registrationsError },
      ] = await Promise.all([
        supabase
          .from("intern_bundles")
          .select("id, name, code")
          .order("code"),

        supabase
          .from("intern_groups")
          .select(
            "id, bundle_id, name, code, capacity, is_active",
          )
          .eq("is_active", true)
          .order("code"),

        supabase
          .from("intern_registrations")
          .select("group_id")
          .eq("status", "confirmed"),
      ]);

      if (bundlesError) {
        console.error(bundlesError);
        setError("Unable to load bundles.");
        setLoading(false);
        return;
      }

      if (groupsError) {
        console.error(groupsError);
        setError("Unable to load groups.");
        setLoading(false);
        return;
      }

      if (registrationsError) {
        console.error(registrationsError);

        setError(
          "Unable to load current registration availability.",
        );

        setLoading(false);
        return;
      }

      const counts: Record<string, number> = {};

      for (const registration of registrationsData ?? []) {
        counts[registration.group_id] =
          (counts[registration.group_id] ?? 0) + 1;
      }

      setBundles(bundlesData ?? []);
      setGroups(groupsData ?? []);
      setRegistrationCounts(counts);
      setLoading(false);
    }

    if (!checkingStatus) {
      loadData();
    }
  }, [checkingStatus, registrationOpen]);

  const groupsWithCounts = useMemo<GroupWithCount[]>(
    () =>
      groups.map((group) => {
        const registeredCount =
          registrationCounts[group.id] ?? 0;

        const availableSeats = Math.max(
          Number(group.capacity) -
            registeredCount,
          0,
        );

        return {
          ...group,
          registeredCount,
          availableSeats,
          isFull:
            Number(group.capacity) > 0 &&
            availableSeats <= 0,
        };
      }),
    [groups, registrationCounts],
  );

  const selectedBundle = bundles.find(
    (bundle) => bundle.id === selectedBundleId,
  );

  const selectedGroup = groupsWithCounts.find(
    (group) => group.id === selectedGroupId,
  );

  const visibleGroups = selectedBundleId
    ? groupsWithCounts.filter(
        (group) =>
          group.bundle_id === selectedBundleId,
      )
    : [];

  async function handleGroupSelect(
    group: GroupWithCount,
  ) {
    if (!registrationOpen) {
      setError("تم غلق التسجيل الالكتروني");
      return;
    }

    if (group.isFull) {
      return;
    }

    setSelectedGroupId(group.id);
    setRotations([]);
    setLoadingSchedule(true);
    setError("");

    const { data, error: scheduleError } =
      await supabase
        .from("intern_rotations")
        .select(
          "id, group_id, rotation_date, department",
        )
        .eq("group_id", group.id)
        .order("rotation_date", {
          ascending: true,
        });

    if (scheduleError) {
      console.error(scheduleError);

      setError(
        "Unable to load the selected group schedule.",
      );

      setLoadingSchedule(false);
      return;
    }

    setRotations(
      sortRotations(data ?? []),
    );

    setLoadingSchedule(false);
  }

  function handleContinue() {
    if (!registrationOpen) {
      setError("تم غلق التسجيل الالكتروني");
      return;
    }

    if (!student) {
      setError(
        "Student information could not be found.",
      );
      return;
    }

    if (!student.batch) {
      setError(
        "Student batch information could not be found. Please go back and complete the registration form.",
      );
      return;
    }

    if (!student.studentPhotoUrl) {
      setError(
        "Student photo could not be found. Please go back and upload it again.",
      );
      return;
    }

    if (!student.identityDocumentUrl) {
      setError(
        "Identity document could not be found. Please go back and upload it again.",
      );
      return;
    }

    if (!selectedBundle || !selectedGroup) {
      setError(
        "Please select a Bundle and a Group.",
      );
      return;
    }

    if (selectedGroup.isFull) {
      setError(
        "This group is full. Please select another group.",
      );
      return;
    }

    if (loadingSchedule) {
      setError(
        "Please wait until the group schedule finishes loading.",
      );
      return;
    }

    sessionStorage.setItem(
      "internship_selected_group",
      JSON.stringify({
        bundleId: selectedBundle.id,
        bundleName: selectedBundle.name,
        bundleCode: selectedBundle.code,

        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        groupCode: selectedGroup.code,

        capacity: selectedGroup.capacity,
        registeredCount:
          selectedGroup.registeredCount,
        availableSeats:
          selectedGroup.availableSeats,

        rotations: rotations.map(
          (rotation) => ({
            id: rotation.id,
            group_id: rotation.group_id,
            rotation_date:
              rotation.rotation_date,
            department:
              rotation.department,
          }),
        ),
      }),
    );

    window.location.href =
      "/register/confirmation";
  }

  function formatDate(dateString: string) {
    return formatRotationDate(dateString);
  }

  if (checkingStatus) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <Loader2
            size={34}
            className="mx-auto animate-spin text-cyan-400"
          />

          <p className="mt-4 text-sm text-slate-300">
            Checking registration status...
          </p>
        </div>
      </main>
    );
  }

  if (!registrationOpen) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 p-8 text-center shadow-2xl md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-500/10 text-red-500">
            <CalendarDays size={38} />
          </div>

          <p className="mt-7 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Internship Registration
          </p>

          <h1 className="mt-4 text-3xl font-black md:text-4xl">
            تم غلق التسجيل الالكتروني
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-400">
            Online internship registration is
            currently closed. Please contact the
            administration if you need further
            information.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-slate-200"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={17} />
            Back
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <GraduationCap size={21} />
            </div>

            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-600">
                Internship Registration
              </p>

              <p className="text-sm font-bold text-slate-900">
                Bundle & Group Selection
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="px-6 py-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-cyan-600">
                Step 2 of 3
              </div>

              <div className="text-slate-400">
                Bundle & Group Selection
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 rounded-full bg-cyan-500" />
            </div>
          </div>

          {student && (
            <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Student
                  </p>

                  <h1 className="mt-1 text-2xl font-bold text-slate-900">
                    {student.fullName}
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Student ID:{" "}
                    <span className="font-semibold text-slate-700">
                      {student.studentCode}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {student.batch && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                        <CalendarDays size={14} />
                        {student.batch}
                      </span>
                    )}

                    {student.nationality && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        {student.nationality}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-5 py-4">
                  <p className="text-xs text-slate-400">
                    GPA
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {student.gpa}
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

              <p className="mt-4 text-sm text-slate-500">
                Loading available Bundles and Groups...
              </p>
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              <section>
                <div className="mb-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                    Select Bundle
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    Choose your internship Bundle
                  </h2>
                </div>

                <div className="grid gap-5 md:grid-cols-4">
                  {bundles.map((bundle) => {
                    const isSelected =
                      bundle.id ===
                      selectedBundleId;

                    return (
                      <button
                        key={bundle.id}
                        type="button"
                        onClick={() => {
                          setSelectedBundleId(
                            bundle.id,
                          );
                          setSelectedGroupId("");
                          setRotations([]);
                          setError("");
                        }}
                        className={`rounded-3xl border p-6 text-left transition ${
                          isSelected
                            ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100"
                            : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-lg"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <GraduationCap
                              size={23}
                            />
                          </div>

                          {isSelected && (
                            <CheckCircle2
                              size={22}
                              className="text-cyan-600"
                            />
                          )}
                        </div>

                        <p className="mt-5 text-sm font-medium text-slate-400">
                          {bundle.code}
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          {bundle.name}
                        </h3>
                      </button>
                    );
                  })}
                </div>
              </section>

              {selectedBundle && (
                <section className="mt-12">
                  <div className="mb-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                      Select Group
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      {selectedBundle.name} Groups
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Select an available group to view
                      its rotation schedule.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">
                    {visibleGroups.map((group) => {
                      const isSelected =
                        group.id ===
                        selectedGroupId;

                      return (
                        <button
                          key={group.id}
                          type="button"
                          disabled={group.isFull}
                          onClick={() =>
                            handleGroupSelect(group)
                          }
                          className={`rounded-3xl border p-6 text-left transition ${
                            group.isFull
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
                              : isSelected
                                ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100"
                                : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-lg"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-400">
                                {group.code}
                              </p>

                              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                                {group.name}
                              </h3>
                            </div>

                            {isSelected ? (
                              <CheckCircle2
                                size={24}
                                className="text-cyan-600"
                              />
                            ) : group.isFull ? (
                              <XCircle
                                size={24}
                                className="text-red-500"
                              />
                            ) : null}
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-400">
                                Capacity
                              </p>

                              <p className="mt-1 text-lg font-bold text-slate-900">
                                {group.capacity > 0
                                  ? group.capacity
                                  : "Not set"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs text-slate-400">
                                Available
                              </p>

                              <p
                                className={`mt-1 text-lg font-bold ${
                                  group.isFull
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {group.capacity > 0
                                  ? group.availableSeats
                                  : "—"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-2 text-sm">
                            {group.isFull ? (
                              <>
                                <XCircle
                                  size={16}
                                  className="text-red-500"
                                />

                                <span className="font-semibold text-red-600">
                                  Group Full
                                </span>
                              </>
                            ) : (
                              <>
                                <Users
                                  size={16}
                                  className="text-slate-400"
                                />

                                <span className="text-slate-500">
                                  {group.registeredCount}{" "}
                                  registered
                                </span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {selectedGroup && (
                <section className="mt-12">
                  <div className="mb-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                      Rotation Schedule
                    </p>

                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      {selectedGroup.name}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {selectedBundle?.name}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    {loadingSchedule ? (
                      <div className="p-10 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

                        <p className="mt-4 text-sm text-slate-500">
                          Loading rotation schedule...
                        </p>
                      </div>
                    ) : rotations.length === 0 ? (
                      <div className="p-10 text-center">
                        <CalendarDays
                          size={32}
                          className="mx-auto text-slate-300"
                        />

                        <h3 className="mt-4 font-bold text-slate-900">
                          No schedule available
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          The rotation schedule for this
                          group has not been added yet.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Clock3
                              size={17}
                              className="text-cyan-600"
                            />

                            Rotation Schedule
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {rotations.map(
                            (rotation) => {
                              const isOut =
                                rotation.department
                                  .trim()
                                  .toLowerCase() ===
                                "out";

                              return (
                                <div
                                  key={
                                    rotation.id
                                  }
                                  className="grid gap-3 px-6 py-5 md:grid-cols-[180px_1fr] md:items-center"
                                >
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <CalendarDays
                                      size={16}
                                      className="text-slate-400"
                                    />

                                    {formatDate(
                                      rotation.rotation_date,
                                    )}
                                  </div>

                                  <div
                                    className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                                      isOut
                                        ? "bg-slate-100 text-slate-600"
                                        : "bg-cyan-50 text-cyan-800"
                                    }`}
                                  >
                                    {rotation.department}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {selectedGroup && (
                <section className="mt-8">
                  <div className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          Your Selection
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          {selectedBundle?.name} —{" "}
                          {selectedGroup.name}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {student?.batch && (
                            <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                              Batch: {student.batch}
                            </span>
                          )}

                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {selectedGroup.availableSeats} seats
                            available
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleContinue}
                        disabled={loadingSchedule}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingSchedule ? (
                          <>
                            <Loader2
                              size={18}
                              className="animate-spin"
                            />
                            Loading...
                          </>
                        ) : (
                          <>
                            Continue to Confirmation
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}