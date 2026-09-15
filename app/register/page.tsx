"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileImage,
  FileText,
  GraduationCap,
  IdCard,
  Loader2,
  Phone,
  Upload,
  UserRound,
} from "lucide-react";

import { supabase } from "@/app/lib/supabase";

type StudentFormData = {
  fullName: string;
  studentCode: string;
  phone: string;
  gpa: string;
  nationalityType: "Egyptian" | "Other" | "";
  nationality: string;
  nationalId: string;
  passportNumber: string;
  batch: string;
};

const BATCH_OPTIONS = [
  "February 2026",
  "July 2026",
  "September 2026",

  "February 2027",
  "July 2027",
  "September 2027",

  "February 2028",
  "July 2028",
  "September 2028",

  "February 2029",
  "July 2029",
  "September 2029",

  "February 2030",
  "July 2030",
  "September 2030",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/*
 * Only image files are allowed.
 *
 * PDF is intentionally NOT included.
 */
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/*
 * Maximum number of upload attempts for
 * temporary network / transport failures.
 */
const MAX_UPLOAD_ATTEMPTS = 3;

function sanitizeDigits(
  value: string,
  maxLength: number,
) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

/*
 * Small delay used between retry attempts.
 */
function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/*
 * Only retry errors that are likely to be
 * temporary network / transport problems.
 *
 * Validation, RLS, file-size, and other permanent
 * errors are NOT retried.
 */
function isRetryableUploadError(
  message: string,
) {
  const normalizedMessage =
    message.toLowerCase();

  return (
    normalizedMessage.includes(
      "fetch failed",
    ) ||
    normalizedMessage.includes(
      "network",
    ) ||
    normalizedMessage.includes(
      "timeout",
    ) ||
    normalizedMessage.includes(
      "timed out",
    ) ||
    normalizedMessage.includes(
      "connection reset",
    ) ||
    normalizedMessage.includes(
      "socket",
    ) ||
    normalizedMessage.includes(
      "500",
    ) ||
    normalizedMessage.includes(
      "502",
    ) ||
    normalizedMessage.includes(
      "503",
    ) ||
    normalizedMessage.includes(
      "504",
    )
  );
}

export default function RegisterPage() {
  const [formData, setFormData] =
    useState<StudentFormData>({
      fullName: "",
      studentCode: "",
      phone: "",
      gpa: "",
      nationalityType: "",
      nationality: "",
      nationalId: "",
      passportNumber: "",
      batch: "",
    });

  const [studentPhoto, setStudentPhoto] =
    useState<File | null>(null);

  const [identityDocument, setIdentityDocument] =
    useState<File | null>(null);

  /*
   * Upload status is only used to show the student
   * whether each selected file was actually uploaded.
   */
  const [studentPhotoUploadStatus, setStudentPhotoUploadStatus] =
    useState<
      "idle" | "uploading" | "success" | "error"
    >("idle");

  const [identityDocumentUploadStatus, setIdentityDocumentUploadStatus] =
    useState<
      "idle" | "uploading" | "success" | "error"
    >("idle");

  const [error, setError] = useState("");

  const [loadingStatus, setLoadingStatus] =
    useState(true);

  const [registrationOpen, setRegistrationOpen] =
    useState(true);

  const [registrationClosesAt, setRegistrationClosesAt] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    async function checkRegistrationStatus() {
      setLoadingStatus(true);

      const timeoutPromise = new Promise<never>(
        (_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Registration status check timed out.",
              ),
            );
          }, 8000);
        },
      );

      try {
        const { data, error: statusError } =
          await Promise.race([
            supabase.rpc(
              "get_internship_registration_status",
            ),
            timeoutPromise,
          ]);

        if (statusError) {
          console.error(statusError);

          /*
           * If the status check fails, the page remains
           * usable. The final registration RPC performs
           * the real security check.
           */
          setRegistrationOpen(true);
          setLoadingStatus(false);
          return;
        }

        const statusRow = Array.isArray(data)
          ? data[0]
          : data;

        const isOpen =
          statusRow?.registration_open !== false;

        setRegistrationOpen(isOpen);

        setRegistrationClosesAt(
          statusRow?.registration_closes_at ?? null,
        );

        setLoadingStatus(false);
      } catch (statusCheckError) {
        console.error(
          "Registration status check failed:",
          statusCheckError,
        );

        /*
         * If Supabase does not respond within 8 seconds,
         * allow the page to continue instead of leaving
         * the user stuck on the loading screen.
         *
         * The final registration RPC remains the
         * authoritative security check.
         */
        setRegistrationOpen(true);
        setLoadingStatus(false);
      }
    }

    checkRegistrationStatus();
  }, []);

  function updateField(
    field: keyof StudentFormData,
    value: string,
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePhoneChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    updateField(
      "phone",
      sanitizeDigits(
        event.target.value,
        11,
      ),
    );
  }

  function handleNationalIdChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    updateField(
      "nationalId",
      sanitizeDigits(
        event.target.value,
        14,
      ),
    );
  }

  function handleNationalityTypeChange(
    value: "Egyptian" | "Other",
  ) {
    setFormData((current) => ({
      ...current,

      nationalityType: value,

      nationality:
        value === "Egyptian"
          ? "Egyptian"
          : "",

      /*
       * Egyptian:
       * keep National ID and clear Passport.
       *
       * Foreign:
       * keep Passport and clear National ID.
       */
      nationalId:
        value === "Egyptian"
          ? current.nationalId
          : "",

      passportNumber:
        value === "Other"
          ? current.passportNumber
          : "",
    }));

    /*
     * Clear the uploaded identity document when
     * switching nationality because the required
     * document type changes.
     */
    setIdentityDocument(null);
    setIdentityDocumentUploadStatus("idle");
    setError("");
  }

  function validateFile(
    file: File,
    label: string,
  ) {
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `${label} must be 5 MB or smaller.`,
      );

      return false;
    }

    /*
     * Images only.
     *
     * PDF is intentionally rejected.
     */
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type,
      )
    ) {
      setError(
        `${label} must be JPG, JPEG, PNG, or WEBP.`,
      );

      return false;
    }

    return true;
  }

  function handleStudentPhotoChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError("");

    const file =
      event.target.files?.[0] ?? null;

    if (!file) {
      setStudentPhoto(null);
      setStudentPhotoUploadStatus("idle");
      return;
    }

    if (
      !validateFile(
        file,
        "Student photo",
      )
    ) {
      event.target.value = "";
      setStudentPhoto(null);
      setStudentPhotoUploadStatus("idle");
      return;
    }

    setStudentPhoto(file);
    setStudentPhotoUploadStatus("idle");
  }

  function handleIdentityDocumentChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setError("");

    const file =
      event.target.files?.[0] ?? null;

    if (!file) {
      setIdentityDocument(null);
      setIdentityDocumentUploadStatus("idle");
      return;
    }

    const documentLabel =
      formData.nationalityType ===
      "Egyptian"
        ? "National ID document"
        : "Passport document";

    if (
      !validateFile(
        file,
        documentLabel,
      )
    ) {
      event.target.value = "";
      setIdentityDocument(null);
      setIdentityDocumentUploadStatus("idle");
      return;
    }

    setIdentityDocument(file);
    setIdentityDocumentUploadStatus("idle");
  }

  async function uploadFile(
    file: File,
    bucket: string,
    folder: string,
  ) {
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      "jpg";

    for (
      let attempt = 1;
      attempt <= MAX_UPLOAD_ATTEMPTS;
      attempt += 1
    ) {
      /*
       * Generate a new unique path for every attempt.
       *
       * This avoids requiring Storage UPDATE permissions
       * when retrying an upload.
       */
      const randomId =
        typeof crypto !== "undefined" &&
        "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

      const filePath =
        `${folder}/${randomId}.${extension}`;

      try {
        const { error: uploadError } =
          await supabase.storage
            .from(bucket)
            .upload(
              filePath,
              file,
              {
                cacheControl: "3600",
                upsert: false,
              },
            );

        if (uploadError) {
          throw new Error(
            uploadError.message ||
              `Unable to upload ${file.name}.`,
          );
        }

        const { data } =
          supabase.storage
            .from(bucket)
            .getPublicUrl(
              filePath,
            );

        if (!data?.publicUrl) {
          throw new Error(
            `Unable to create a URL for ${file.name}.`,
          );
        }

        return data.publicUrl;
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : `Unable to upload ${file.name}.`;

        const canRetry =
          attempt <
            MAX_UPLOAD_ATTEMPTS &&
          isRetryableUploadError(
            message,
          );

        if (!canRetry) {
          throw new Error(message);
        }

        /*
         * Wait progressively longer before retrying:
         *
         * Attempt 1 -> 500 ms
         * Attempt 2 -> 1000 ms
         */
        const delay =
          attempt === 1
            ? 500
            : 1000;

        console.warn(
          `[UPLOAD RETRY] ${bucket} | ${file.name} | attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS} failed: ${message} | retrying in ${delay} ms`,
        );

        await wait(delay);
      }
    }

    throw new Error(
      `Unable to upload ${file.name}.`,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");

    if (!registrationOpen) {
      setError(
        "تم غلق التسجيل الالكتروني",
      );

      return;
    }

    const fullName =
      formData.fullName.trim();

    const studentCode =
      formData.studentCode.trim();

    const phone =
      formData.phone.trim();

    const gpa =
      formData.gpa.trim();

    const nationalityType =
      formData.nationalityType;

    const nationality =
      formData.nationality.trim();

    const nationalId =
      formData.nationalId.trim();

    const passportNumber =
      formData.passportNumber.trim();

    const batch =
      formData.batch.trim();

    /*
     * Basic required fields.
     */
    if (
      !fullName ||
      !studentCode ||
      !phone ||
      !gpa ||
      !nationalityType ||
      !batch
    ) {
      setError(
        "Please complete all required fields.",
      );

      return;
    }

    /*
     * Phone validation.
     */
    if (
      phone.length !== 11 ||
      !/^\d{11}$/.test(phone)
    ) {
      setError(
        "Phone number must contain exactly 11 digits.",
      );

      return;
    }

    /*
     * Egyptian student:
     * National ID is required.
     *
     * Passport must NOT be used.
     */
    if (
      nationalityType ===
      "Egyptian"
    ) {
      if (
        nationalId.length !== 14 ||
        !/^\d{14}$/.test(
          nationalId,
        )
      ) {
        setError(
          "Egyptian National ID must contain exactly 14 digits.",
        );

        return;
      }

      /*
       * Make absolutely sure the foreign field
       * is not submitted for Egyptian students.
       */
      if (passportNumber) {
        setFormData((current) => ({
          ...current,
          passportNumber: "",
        }));
      }
    }

    /*
     * Foreign student:
     * Passport is required.
     *
     * National ID must NOT be used.
     */
    if (
      nationalityType ===
      "Other"
    ) {
      if (!nationality) {
        setError(
          "Please enter your nationality.",
        );

        return;
      }

      if (!passportNumber) {
        setError(
          "Passport Number is required for foreign students.",
        );

        return;
      }

      /*
       * Make absolutely sure the Egyptian field
       * is not submitted for foreign students.
       */
      if (nationalId) {
        setFormData((current) => ({
          ...current,
          nationalId: "",
        }));
      }
    }

    /*
     * GPA validation.
     */
    const numericGpa =
      Number(gpa);

    if (
      Number.isNaN(numericGpa) ||
      numericGpa < 0 ||
      numericGpa > 4
    ) {
      setError(
        "Please enter a valid GPA between 0 and 4.",
      );

      return;
    }

    /*
     * Student photo.
     */
    if (!studentPhoto) {
      setError(
        "Please upload your student photo.",
      );

      return;
    }

    /*
     * National ID / Passport document.
     */
    if (!identityDocument) {
      setError(
        nationalityType ===
        "Egyptian"
          ? "Please upload your National ID document."
          : "Please upload your Passport document.",
      );

      return;
    }

    setSubmitting(true);

    try {
      /*
       * Upload student photo.
       *
       * The upload function automatically retries
       * temporary network / transport failures.
       */
      setStudentPhotoUploadStatus(
        "uploading",
      );

      const studentPhotoUrl =
        await uploadFile(
          studentPhoto,
          "student-photos",
          "students",
        );

      /*
       * Student photo has now been successfully
       * uploaded to Supabase Storage.
       */
      setStudentPhotoUploadStatus(
        "success",
      );

      /*
       * Upload National ID / Passport.
       *
       * This is a separate upload, so if this one
       * encounters a temporary failure, only this
       * file is retried.
       */
      setIdentityDocumentUploadStatus(
        "uploading",
      );

      const identityDocumentUrl =
        await uploadFile(
          identityDocument,
          "identity-documents",
          "students",
        );

      /*
       * Identity document has now been successfully
       * uploaded to Supabase Storage.
       */
      setIdentityDocumentUploadStatus(
        "success",
      );

      /*
       * Store the complete form temporarily.
       *
       * Final registration is created later on
       * the Confirmation page through the secure RPC.
       */
      sessionStorage.setItem(
        "internship_student_data",
        JSON.stringify({
          fullName,
          studentCode,
          phone,
          gpa: numericGpa,

          nationality:
            nationalityType ===
            "Egyptian"
              ? "Egyptian"
              : nationality,

          nationalityType,

          /*
           * Egyptian -> National ID only.
           */
          nationalId:
            nationalityType ===
            "Egyptian"
              ? nationalId
              : "",

          /*
           * Foreign -> Passport only.
           */
          passportNumber:
            nationalityType ===
            "Other"
              ? passportNumber
              : "",

          batch,

          studentPhotoUrl,

          identityDocumentUrl,
        }),
      );

      /*
       * Continue to Bundle / Group selection.
       */
      window.location.href =
        "/register/select-group";
    } catch (uploadError) {
      console.error(
        uploadError,
      );

      /*
       * Show the correct upload state if one
       * of the uploads fails.
       */
      if (
        studentPhotoUploadStatus ===
        "uploading"
      ) {
        setStudentPhotoUploadStatus(
          "error",
        );
      }

      if (
        identityDocumentUploadStatus ===
        "uploading"
      ) {
        setIdentityDocumentUploadStatus(
          "error",
        );
      }

      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload the required documents.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * Registration is closed.
   */
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
            currently closed. Please contact
            the administration if you need
            further information.
          </p>

          {registrationClosesAt && (
            <p className="mt-5 text-xs text-slate-500">
              Registration is currently closed.
            </p>
          )}

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

  /*
   * Loading registration status.
   */
  if (loadingStatus) {
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

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Home
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-black">
              <GraduationCap size={21} />
            </div>

            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">
                Internship Registration
              </p>

              <p className="text-sm font-bold text-white">
                Student Information
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Page */}
      <section className="px-6 py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-cyan-400">
                Step 1 of 3
              </div>

              <div className="text-slate-500">
                Student Information
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/3 rounded-full bg-cyan-500" />
            </div>
          </div>

          {/* Card */}
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl md:p-9">
            <div className="mb-8">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <UserRound size={26} />
              </div>

              <h1 className="text-3xl font-bold text-white">
                Student Information
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Enter your information carefully
                before continuing to Bundle and
                Group selection.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Full Name
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <UserRound
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    id="fullName"
                    type="text"
                    value={
                      formData.fullName
                    }
                    onChange={(event) =>
                      updateField(
                        "fullName",
                        event.target.value,
                      )
                    }
                    placeholder="Enter your full name"
                    className="w-full rounded-2xl border border-slate-800 bg-black py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              {/* Student ID */}
              <div>
                <label
                  htmlFor="studentCode"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Student ID / Code
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <IdCard
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    id="studentCode"
                    type="text"
                    value={
                      formData.studentCode
                    }
                    onChange={(event) =>
                      updateField(
                        "studentCode",
                        event.target.value,
                      )
                    }
                    placeholder="Enter your student ID"
                    className="w-full rounded-2xl border border-slate-800 bg-black py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-slate-200"
                >
                  Phone Number
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={
                      formData.phone
                    }
                    onChange={
                      handlePhoneChange
                    }
                    placeholder="Enter 11-digit phone number"
                    className="w-full rounded-2xl border border-slate-800 bg-black py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Exactly 11 digits required.
                  <span className="ml-2 text-slate-400">
                    {formData.phone.length}/11
                  </span>
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* GPA */}
                <div>
                  <label
                    htmlFor="gpa"
                    className="mb-2 block text-sm font-semibold text-slate-200"
                  >
                    GPA
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="gpa"
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    value={
                      formData.gpa
                    }
                    onChange={(event) =>
                      updateField(
                        "gpa",
                        event.target.value,
                      )
                    }
                    placeholder="Example: 3.25"
                    className="w-full rounded-2xl border border-slate-800 bg-black px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Enter a value from 0 to 4.
                  </p>
                </div>

                {/* Batch */}
                <div>
                  <label
                    htmlFor="batch"
                    className="mb-2 block text-sm font-semibold text-slate-200"
                  >
                    Internship Batch
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />

                    <select
                      id="batch"
                      value={
                        formData.batch
                      }
                      onChange={(event) =>
                        updateField(
                          "batch",
                          event.target.value,
                        )
                      }
                      className="w-full appearance-none rounded-2xl border border-slate-800 bg-black py-3.5 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    >
                      <option
                        value=""
                        className="bg-slate-950"
                      >
                        Select your batch
                      </option>

                      {BATCH_OPTIONS.map(
                        (batch) => (
                          <option
                            key={batch}
                            value={batch}
                            className="bg-slate-950"
                          >
                            {batch}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Nationality */}
              <div className="border-t border-slate-800 pt-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-white">
                    Nationality
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Select your nationality.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Egyptian */}
                  <button
                    type="button"
                    onClick={() =>
                      handleNationalityTypeChange(
                        "Egyptian",
                      )
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      formData.nationalityType ===
                      "Egyptian"
                        ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/10"
                        : "border-slate-800 bg-black hover:border-slate-600"
                    }`}
                  >
                    <p className="font-bold text-white">
                      Egyptian
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      National ID required
                    </p>
                  </button>

                  {/* Foreign */}
                  <button
                    type="button"
                    onClick={() =>
                      handleNationalityTypeChange(
                        "Other",
                      )
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      formData.nationalityType ===
                      "Other"
                        ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/10"
                        : "border-slate-800 bg-black hover:border-slate-600"
                    }`}
                  >
                    <p className="font-bold text-white">
                      Foreign
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Passport required
                    </p>
                  </button>
                </div>

                {/* Foreign nationality */}
                {formData.nationalityType ===
                  "Other" && (
                  <div className="mt-5">
                    <label
                      htmlFor="nationality"
                      className="mb-2 block text-sm font-semibold text-slate-200"
                    >
                      Your Nationality
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      id="nationality"
                      type="text"
                      value={
                        formData.nationality
                      }
                      onChange={(event) =>
                        updateField(
                          "nationality",
                          event.target.value,
                        )
                      }
                      placeholder="Enter your nationality"
                      className="w-full rounded-2xl border border-slate-800 bg-black px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                )}
              </div>

              {/* Identification */}
              <div className="border-t border-slate-800 pt-6">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white">
                    Identification
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Only the identification type
                    required for your nationality
                    will be requested.
                  </p>
                </div>

                {/* Egyptian -> National ID only */}
                {formData.nationalityType ===
                  "Egyptian" && (
                  <div>
                    <label
                      htmlFor="nationalId"
                      className="mb-2 block text-sm font-semibold text-slate-200"
                    >
                      National ID
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <IdCard
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      />

                      <input
                        id="nationalId"
                        type="text"
                        inputMode="numeric"
                        maxLength={14}
                        value={
                          formData.nationalId
                        }
                        onChange={
                          handleNationalIdChange
                        }
                        placeholder="Enter 14-digit National ID"
                        className="w-full rounded-2xl border border-slate-800 bg-black py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Exactly 14 digits required.
                      <span className="ml-2 text-slate-400">
                        {formData.nationalId.length}/14
                      </span>
                    </p>
                  </div>
                )}

                {/* Foreign -> Passport only */}
                {formData.nationalityType ===
                  "Other" && (
                  <div>
                    <label
                      htmlFor="passportNumber"
                      className="mb-2 block text-sm font-semibold text-slate-200"
                    >
                      Passport Number
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      id="passportNumber"
                      type="text"
                      value={
                        formData.passportNumber
                      }
                      onChange={(event) =>
                        updateField(
                          "passportNumber",
                          event.target.value.toUpperCase(),
                        )
                      }
                      placeholder="Enter Passport Number"
                      className="w-full rounded-2xl border border-slate-800 bg-black px-4 py-3.5 text-sm uppercase text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                )}

                {!formData.nationalityType && (
                  <div className="rounded-2xl border border-slate-800 bg-black p-5 text-sm text-slate-500">
                    Please select your nationality
                    first.
                  </div>
                )}
              </div>

              {/* Uploads */}
              <div className="border-t border-slate-800 pt-6">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white">
                    Required Documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Maximum file size is 5 MB per
                    file. Images only: JPG, JPEG, PNG,
                    or WEBP.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* Student Photo */}
                  <div className="rounded-3xl border border-slate-800 bg-black p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                        <FileImage
                          size={21}
                        />
                      </div>

                      <div>
                        <p className="font-bold text-white">
                          Student Photo
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </p>

                        <p className="text-xs text-slate-500">
                          JPG, JPEG, PNG or WEBP
                        </p>
                      </div>
                    </div>

                    <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-4 py-7 text-center transition hover:border-cyan-500 hover:bg-slate-900">
                      <Upload
                        size={24}
                        className="text-slate-500"
                      />

                      <p className="mt-3 text-sm font-semibold text-slate-300">
                        {studentPhoto
                          ? studentPhoto.name
                          : "Choose student photo"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Click to upload
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                          handleStudentPhotoChange
                        }
                        className="hidden"
                      />
                    </label>

                    {studentPhotoUploadStatus ===
                      "uploading" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-300">
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Uploading student photo...
                      </div>
                    )}

                    {studentPhotoUploadStatus ===
                      "success" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
                        <CheckCircle2
                          size={17}
                        />
                        Student photo uploaded successfully
                      </div>
                    )}

                    {studentPhotoUploadStatus ===
                      "error" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                        <FileImage
                          size={17}
                        />
                        Student photo upload failed
                      </div>
                    )}
                  </div>

                  {/* Identity Document */}
                  <div className="rounded-3xl border border-slate-800 bg-black p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                        <FileText
                          size={21}
                        />
                      </div>

                      <div>
                        <p className="font-bold text-white">
                          {formData.nationalityType ===
                          "Other"
                            ? "Passport Document"
                            : "National ID Document"}

                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </p>

                        <p className="text-xs text-slate-500">
                          JPG, JPEG, PNG or WEBP
                        </p>
                      </div>
                    </div>

                    <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 px-4 py-7 text-center transition hover:border-cyan-500 hover:bg-slate-900">
                      <Upload
                        size={24}
                        className="text-slate-500"
                      />

                      <p className="mt-3 break-all text-sm font-semibold text-slate-300">
                        {identityDocument
                          ? identityDocument.name
                          : formData.nationalityType ===
                            "Other"
                            ? "Choose passport document"
                            : "Choose National ID document"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Click to upload
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                          handleIdentityDocumentChange
                        }
                        className="hidden"
                      />
                    </label>

                    {identityDocumentUploadStatus ===
                      "uploading" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-300">
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Uploading{" "}
                        {formData.nationalityType ===
                        "Other"
                          ? "passport document"
                          : "National ID document"}
                        ...
                      </div>
                    )}

                    {identityDocumentUploadStatus ===
                      "success" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
                        <CheckCircle2
                          size={17}
                        />
                        {formData.nationalityType ===
                        "Other"
                          ? "Passport document"
                          : "National ID document"}{" "}
                        uploaded successfully
                      </div>
                    )}

                    {identityDocumentUploadStatus ===
                      "error" && (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                        <FileText
                          size={17}
                        />
                        {formData.nationalityType ===
                        "Other"
                          ? "Passport document"
                          : "National ID document"}{" "}
                        upload failed
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-2xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm leading-6 text-red-300">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end border-t border-slate-800 pt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-6 py-4 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />

                      Uploading...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight
                        size={18}
                      />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}