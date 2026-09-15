"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  IdCard,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
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

type SelectedGroup = {
  bundleId: string;
  bundleName: string;
  bundleCode: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  capacity?: number;
  registeredCount?: number;
  availableSeats?: number;
  rotations?: Rotation[];
};

type Rotation = {
  id: string;
  group_id: string;
  rotation_date: string;
  department: string;
};

type RegistrationResult = {
  registration_id: string;
  registration_number: string;
  student_id: string;
  group_id: string;
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
      rotationDateOrder.get(
        first.rotation_date.trim(),
      ) ?? Number.MAX_SAFE_INTEGER;

    const secondOrder =
      rotationDateOrder.get(
        second.rotation_date.trim(),
      ) ?? Number.MAX_SAFE_INTEGER;

    return (
      firstOrder - secondOrder ||
      first.rotation_date.localeCompare(
        second.rotation_date,
      )
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

export default function ConfirmationPage() {
  const [student, setStudent] =
    useState<StudentData | null>(null);

  const [selection, setSelection] =
    useState<SelectedGroup | null>(null);

  const [rotations, setRotations] =
    useState<Rotation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingSchedule, setLoadingSchedule] =
    useState(false);

  const [checkingStatus, setCheckingStatus] =
    useState(true);

  const [registrationOpen, setRegistrationOpen] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const [registration, setRegistration] =
    useState<RegistrationResult | null>(null);

  useEffect(() => {
    async function checkRegistrationStatus() {
      setCheckingStatus(true);

      const {
        data,
        error: statusError,
      } = await supabase.rpc(
        "get_internship_registration_status",
      );

      if (statusError) {
        console.error(statusError);

        /*
         * The final registration RPC performs
         * the authoritative registration-open check.
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
    async function loadConfirmationData() {
      setLoading(true);
      setError("");

      const storedStudent =
        sessionStorage.getItem(
          "internship_student_data",
        );

      const storedSelection =
        sessionStorage.getItem(
          "internship_selected_group",
        );

      if (!storedStudent || !storedSelection) {
        window.location.href = "/register";
        return;
      }

      try {
        const parsedStudent =
          JSON.parse(
            storedStudent,
          ) as StudentData;

        const parsedSelection =
          JSON.parse(
            storedSelection,
          ) as SelectedGroup;

        if (
          !parsedStudent.fullName ||
          !parsedStudent.studentCode ||
          !parsedStudent.phone ||
          parsedStudent.gpa === undefined ||
          !parsedStudent.nationality ||
          !parsedStudent.batch ||
          !parsedStudent.studentPhotoUrl ||
          !parsedStudent.identityDocumentUrl ||
          !parsedSelection.bundleId ||
          !parsedSelection.groupId
        ) {
          throw new Error(
            "Incomplete registration data.",
          );
        }

        setStudent(parsedStudent);
        setSelection(parsedSelection);

        if (
          parsedSelection.rotations &&
          Array.isArray(
            parsedSelection.rotations,
          )
        ) {
          setRotations(
            sortRotations(
              parsedSelection.rotations,
            ),
          );
        }

        setLoadingSchedule(true);

        const {
          data,
          error: scheduleError,
        } = await supabase
          .from("intern_rotations")
          .select(
            "id, group_id, rotation_date, department",
          )
          .eq(
            "group_id",
            parsedSelection.groupId,
          )
          .order("rotation_date", {
            ascending: true,
          });

        if (scheduleError) {
          console.error(scheduleError);

          setError(
            "Unable to load the rotation schedule.",
          );
        } else {
          setRotations(
            sortRotations(data ?? []),
          );
        }

        setLoadingSchedule(false);
      } catch (storageError) {
        console.error(storageError);

        sessionStorage.removeItem(
          "internship_student_data",
        );

        sessionStorage.removeItem(
          "internship_selected_group",
        );

        window.location.href = "/register";
        return;
      }

      setLoading(false);
    }

    loadConfirmationData();
  }, []);

  const isReady = useMemo(() => {
    return Boolean(
      student && selection,
    );
  }, [student, selection]);

  async function handleConfirmRegistration() {
    if (!registrationOpen) {
      setError(
        "تم غلق التسجيل الالكتروني",
      );
      return;
    }

    if (!student || !selection) {
      setError(
        "Registration information is incomplete.",
      );
      return;
    }

    if (submitting || registration) {
      return;
    }

    if (!student.batch) {
      setError(
        "Batch information is missing.",
      );
      return;
    }

    if (!student.studentPhotoUrl) {
      setError(
        "Student photo is missing.",
      );
      return;
    }

    if (!student.identityDocumentUrl) {
      setError(
        "Identity document is missing.",
      );
      return;
    }

    if (
      selection.availableSeats !==
      undefined
    ) {
      if (
        Number(
          selection.availableSeats,
        ) <= 0
      ) {
        setError(
          "This group is now full. Please go back and select another group.",
        );
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const {
        data,
        error: registrationError,
      } = await supabase.rpc(
        "submit_intern_registration",
        {
          p_full_name:
            student.fullName,

          p_student_code:
            student.studentCode,

          p_phone:
            student.phone,

          p_gpa:
            student.gpa,

          p_nationality:
            student.nationality,

          p_national_id:
            student.nationalId || null,

          p_passport_number:
            student.passportNumber || null,

          p_group_id:
            selection.groupId,

          p_batch:
            student.batch,

          p_student_photo_url:
            student.studentPhotoUrl,

          p_identity_document_url:
            student.identityDocumentUrl,
        },
      );

      if (registrationError) {
        console.error(
          "Registration error:",
          registrationError,
        );

        throw new Error(
          registrationError.message ||
            "Unable to complete registration.",
        );
      }

      if (
        !data ||
        !Array.isArray(data) ||
        data.length === 0
      ) {
        throw new Error(
          "Registration was not completed. No registration result was returned.",
        );
      }

      const result =
        data[0] as RegistrationResult;

      if (!result.registration_id) {
        throw new Error(
          "Registration was not completed correctly.",
        );
      }

      setRegistration(result);

      /*
       * The registration is now permanently recorded.
       * Remove temporary browser data so the same
       * session cannot accidentally resubmit it.
       */
      sessionStorage.removeItem(
        "internship_student_data",
      );

      sessionStorage.removeItem(
        "internship_selected_group",
      );
    } catch (submitError) {
      console.error(submitError);

      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete registration.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(
    dateString: string,
  ) {
    return formatRotationDate(
      dateString,
    );
  }

  if (
    loading ||
    checkingStatus
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Loader2
              size={28}
              className="animate-spin text-cyan-600"
            />
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">
            Preparing your registration
            confirmation...
          </p>
        </div>
      </main>
    );
  }

  if (
    !registrationOpen &&
    !registration
  ) {
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

  if (
    !isReady ||
    !student ||
    !selection
  ) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * SUCCESS SCREEN
   * -------------------------------------------------------
   */

  if (registration) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft size={17} />
              Back to Home
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
                  Registration Confirmed
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="px-6 py-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm">
                <div className="font-semibold text-emerald-600">
                  Completed
                </div>

                <div className="text-slate-400">
                  Registration Confirmed
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-900 px-6 py-10 text-center text-white md:px-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500">
                  <CheckCircle2 size={34} />
                </div>

                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Registration Successful
                </p>

                <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                  Your Internship Registration is Confirmed
                </h1>

                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                  Your registration has been successfully
                  recorded. Please keep your registration
                  number for future reference.
                </p>
              </div>

              <div className="p-6 md:p-10">
                <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    Registration Number
                  </p>

                  <p className="mt-3 break-all text-3xl font-black tracking-wider text-slate-900 md:text-4xl">
                    {
                      registration.registration_number
                    }
                  </p>

                  <p className="mt-3 text-sm text-slate-500">
                    Keep this number for your records.
                  </p>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <UserRound size={20} />
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Student
                        </p>

                        <p className="font-bold text-slate-900">
                          {student.fullName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <p className="text-xs text-slate-400">
                        Student ID
                      </p>

                      <p className="mt-1 font-semibold text-slate-800">
                        {student.studentCode}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                        <GraduationCap size={20} />
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Internship Bundle
                        </p>

                        <p className="font-bold text-slate-900">
                          {selection.bundleName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <p className="text-xs text-slate-400">
                        Group
                      </p>

                      <p className="mt-1 font-semibold text-slate-800">
                        {selection.groupName}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {selection.groupCode}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center gap-3">
                      <CalendarDays
                        size={20}
                        className="text-cyan-600"
                      />

                      <div>
                        <p className="text-xs text-slate-400">
                          Internship Batch
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          {student.batch}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck
                        size={20}
                        className="text-emerald-600"
                      />

                      <div>
                        <p className="text-xs text-slate-400">
                          Documents
                        </p>

                        <p className="mt-1 font-bold text-emerald-700">
                          Submitted Successfully
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck
                      size={20}
                      className="text-emerald-600"
                    />

                    <h2 className="font-bold text-slate-900">
                      Registration Details
                    </h2>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-400">
                        Nationality
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {student.nationality}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        GPA
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {student.gpa}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Phone
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {student.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {rotations.length > 0 && (
                  <div className="mt-8">
                    <div className="mb-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                        Rotation Schedule
                      </p>

                      <h2 className="mt-1 text-2xl font-bold text-slate-900">
                        {selection.groupName}
                      </h2>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-slate-200">
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
                                key={rotation.id}
                                className="grid gap-3 bg-white px-6 py-5 md:grid-cols-[190px_1fr] md:items-center"
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
                    </div>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      window.print()
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-800"
                  >
                    Print Confirmation
                  </button>

                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  /*
   * -------------------------------------------------------
   * CONFIRMATION SCREEN
   * -------------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/register/select-group"
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
                Final Confirmation
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="px-6 py-10 md:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-cyan-600">
                Step 3 of 3
              </div>

              <div className="text-slate-400">
                Final Confirmation
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-full rounded-full bg-cyan-500" />
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <ShieldCheck size={27} />
            </div>

            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Review Your Registration
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Please review all information carefully.
              Your registration will be submitted only
              after you click Confirm Registration.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-700">
              <p className="font-semibold">
                Registration could not be completed.
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            {/* Student Information */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <UserRound size={21} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Student Information
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Personal Details
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs text-slate-400">
                    Full Name
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {student.fullName}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-400">
                      Student ID
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <IdCard
                        size={15}
                        className="text-slate-400"
                      />

                      <p className="font-semibold text-slate-800">
                        {student.studentCode}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      Phone
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <Phone
                        size={15}
                        className="text-slate-400"
                      />

                      <p className="font-semibold text-slate-800">
                        {student.phone}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-400">
                      GPA
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {student.gpa}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      Internship Batch
                    </p>

                    <p className="mt-1 font-semibold text-cyan-700">
                      {student.batch}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Nationality
                  </p>

                  <p className="mt-1 font-semibold text-slate-800">
                    {student.nationality}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Identification
                  </p>

                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400">
                        National ID
                      </p>

                      <p className="mt-1 font-semibold text-slate-800">
                        {student.nationalId ||
                          "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Passport Number
                      </p>

                      <p className="mt-1 font-semibold text-slate-800">
                        {student.passportNumber ||
                          "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Bundle & Group */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <GraduationCap size={21} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Internship Selection
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Bundle & Group
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-xs text-slate-400">
                    Bundle Code
                  </p>

                  <p className="mt-1 text-sm font-semibold text-cyan-700">
                    {selection.bundleCode}
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {selection.bundleName}
                  </p>
                </div>

                <div className="rounded-2xl bg-cyan-50 p-5">
                  <p className="text-xs text-cyan-700">
                    Selected Group
                  </p>

                  <p className="mt-1 text-sm font-semibold text-cyan-700">
                    {selection.groupCode}
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {selection.groupName}
                  </p>
                </div>

                {selection.capacity !==
                  undefined && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Capacity
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {selection.capacity}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Available
                      </p>

                      <p className="mt-1 text-lg font-bold text-emerald-600">
                        {selection.availableSeats ??
                          "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Uploaded Documents */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <FileCheck2 size={21} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Required Documents
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Uploaded Successfully
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                    <UserRound size={20} />
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      Student Photo
                    </p>

                    <p className="mt-1 font-semibold text-emerald-700">
                      Uploaded
                    </p>
                  </div>
                </div>

                <a
                  href={
                    student.studentPhotoUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                >
                  <FileText size={16} />
                  View Uploaded File
                </a>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                    <IdCard size={20} />
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">
                      {student.nationalityType ===
                      "Other"
                        ? "Passport Document"
                        : "National ID Document"}
                    </p>

                    <p className="mt-1 font-semibold text-emerald-700">
                      Uploaded
                    </p>
                  </div>
                </div>

                <a
                  href={
                    student.identityDocumentUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                >
                  <FileText size={16} />
                  View Uploaded File
                </a>
              </div>
            </div>
          </section>

          {/* Rotation Schedule */}
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5 md:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <CalendarDays size={21} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Schedule
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Rotation Schedule
                  </h2>
                </div>
              </div>
            </div>

            {loadingSchedule ? (
              <div className="p-10 text-center">
                <Loader2
                  size={28}
                  className="mx-auto animate-spin text-cyan-600"
                />

                <p className="mt-4 text-sm text-slate-500">
                  Loading rotation schedule...
                </p>
              </div>
            ) : rotations.length === 0 ? (
              <div className="p-8 text-center">
                <CalendarDays
                  size={30}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No rotation schedule available.
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  The group schedule has not been added yet.
                </p>
              </div>
            ) : (
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
                        key={rotation.id}
                        className="grid gap-3 px-6 py-5 md:grid-cols-[190px_1fr] md:items-center md:px-7"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Clock3
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
            )}
          </section>

          {/* Security Notice */}
          <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck
                size={21}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <div>
                <p className="font-semibold text-emerald-900">
                  Secure Final Registration
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Your information, documents, group
                  capacity, and existing registrations will
                  be validated before your registration is
                  confirmed.
                </p>
              </div>
            </div>
          </div>

          {/* Confirm */}
          <section className="mt-8">
            <div className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    Final Selection
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    {selection.bundleName} —{" "}
                    {selection.groupName}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Click Confirm Registration to complete
                    your internship registration.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleConfirmRegistration
                  }
                  disabled={
                    submitting ||
                    Boolean(registration)
                  }
                  className="inline-flex min-w-[230px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirm Registration
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}