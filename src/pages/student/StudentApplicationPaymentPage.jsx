import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, LockKeyhole, School, Upload, XCircle } from "lucide-react";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { isSupportedDocumentFile } from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentApplications } from "../../store/slices/applicationsSlice";
import {
  confirmStripeCheckoutSession,
  createStripeCheckoutSession,
  fetchPaymentApplication,
  resetPaymentState,
  submitApplicationPayment,
} from "../../store/slices/paymentsSlice";

const resolveUniversityName = (university) => {
  if (!university) return "University";
  if (typeof university === "string") return "University";
  return university.name || "University";
};

const resolveApplicationUniversityName = (application) =>
  application?.universityProfile?.universityName || resolveUniversityName(application?.university);

const resolveApplicationUniversityLogo = (application) =>
  application?.universityProfile?.logo ||
  application?.universityLogo ||
  "";

export const StudentApplicationPaymentPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { universityId, applicationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentApplication: application,
    loading: isLoading,
    error: loadError,
    processing: isProcessing,
    checkoutError,
    confirming: isConfirming,
    confirmError,
  } = useAppSelector((state) => state.payments);
  const [localError, setLocalError] = useState("");
  const [verifiedStripeSession, setVerifiedStripeSession] = useState(null);
  const [paymentProof, setPaymentProof] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");

  useEffect(() => {
    dispatch(fetchPaymentApplication(applicationId));
    return () => {
      dispatch(resetPaymentState());
    };
  }, [dispatch, applicationId]);

  const stripeStatus = searchParams.get("stripe") || "";
  const stripeSessionId = searchParams.get("session_id") || "";

  useEffect(() => {
    if (stripeStatus !== "success" || !stripeSessionId || !applicationId) return;
    if (verifiedStripeSession?.id === stripeSessionId) return;

    dispatch(confirmStripeCheckoutSession({ applicationId, sessionId: stripeSessionId }))
      .unwrap()
      .then((payload) => {
        if (payload?.stripeSession?.paymentStatus === "paid") {
          setVerifiedStripeSession(payload.stripeSession);
        }
      })
      .catch((error) => {
        setLocalError(typeof error === "string" ? error : error?.message || "Unable to verify Stripe payment.");
      });
  }, [applicationId, dispatch, stripeSessionId, stripeStatus, verifiedStripeSession?.id]);

  const isAlreadyPaid = useMemo(
    () => application?.payment?.status === "paid",
    [application?.payment?.status],
  );

  const applicationUniversityId = useMemo(
    () => application?.university?._id || application?.university?.id || application?.university,
    [application],
  );

  const effectiveUniversityId = String(universityId || applicationUniversityId || "");

  const hasUniversityMismatch = useMemo(
    () =>
      Boolean(
        application &&
          universityId &&
          applicationUniversityId &&
          String(applicationUniversityId) !== String(universityId),
      ),
    [application, applicationUniversityId, universityId],
  );

  const effectiveLoadError = hasUniversityMismatch
    ? "Application does not match selected university."
    : loadError;

  const amountDue = Number(application?.payment?.amount || 0);
  const applicationDisplayId = application?.applicationCode || application?._id || applicationId;

  const startStripeCheckout = async () => {
    setLocalError("");
    if (!application?._id) {
      setLocalError("Application draft not found.");
      return;
    }

    try {
      const checkout = await dispatch(createStripeCheckoutSession(application._id)).unwrap();
      if (checkout?.alreadyPaid) {
        dispatch(fetchStudentApplications());
        navigate("/student/applications", { state: { applicationId: application._id } });
        return;
      }

      if (!checkout?.checkoutUrl) {
        setLocalError("Stripe checkout URL was not returned.");
        return;
      }

      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setLocalError(typeof error === "string" ? error : error?.message || "Unable to start Stripe checkout.");
    }
  };

  const handleProofChange = async (file) => {
    setLocalError("");
    if (!file) return;

    if (!isSupportedDocumentFile(file)) {
      setLocalError("Payment screenshot must be a PDF, JPG, or PNG file.");
      return;
    }

    try {
      setPaymentProof(await readFileAsDataUrl(file));
      setPaymentProofFileName(file.name);
    } catch (error) {
      setLocalError(error?.message || "Unable to read payment screenshot.");
    }
  };

  const submitSuccessfulPaymentProof = async () => {
    setLocalError("");

    if (!verifiedStripeSession?.id && !stripeSessionId) {
      setLocalError("Stripe payment must be completed before uploading proof.");
      return;
    }

    if (!paymentProof) {
      setLocalError("Upload a screenshot of the successful Stripe payment.");
      return;
    }

    try {
      await dispatch(
        submitApplicationPayment({
          applicationId: application._id,
          payload: {
            method: "card",
            stripeSessionId: verifiedStripeSession?.id || stripeSessionId,
            transactionReference: verifiedStripeSession?.id || stripeSessionId,
            paymentProof,
            paymentProofFileName,
          },
        }),
      ).unwrap();
      dispatch(fetchStudentApplications());
      setSearchParams({}, { replace: true });
      navigate("/student/applications", { state: { applicationId: application._id } });
    } catch (error) {
      setLocalError(typeof error === "string" ? error : error?.message || "Unable to submit payment screenshot.");
    }
  };

  if (isLoading) {
    return (
      <DashboardPageShell title="Application Payment" subtitle="Loading application draft...">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Fetching payment details...
        </div>
      </DashboardPageShell>
    );
  }

  if (effectiveLoadError || !application) {
    return (
      <DashboardPageShell
        title="Application Payment"
        subtitle={effectiveLoadError || "Application could not be loaded."}
        actions={
          <button
            onClick={() => navigate("/student/applications")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to Applications
          </button>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Please create an application draft first, then continue to payment.
        </div>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell
      title="Application Payment"
      subtitle={`${resolveApplicationUniversityName(application)} - ${application.program || "Program"}`}
      actions={
        <button
          onClick={() =>
            navigate(
              `/student/apply/${effectiveUniversityId}?program=${encodeURIComponent(
                application.program || "",
              )}&draft=${encodeURIComponent(application._id || applicationId)}`,
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Form
        </button>
      }
    >
      <UniversityPaymentHeader application={application} />

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg bg-emerald-50 px-4 py-4 text-emerald-800">
            <p className="text-sm font-semibold">Amount Due</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl">
              PKR {amountDue.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-emerald-700">
              Application fee for {application.program || "selected program"}.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-medium uppercase text-slate-500">Application ID</p>
            <p className="mt-1 break-all text-base font-semibold text-slate-900">
              {applicationDisplayId}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Stripe payment will be recorded against this same application.
            </p>
          </div>
        </div>

        {stripeStatus === "cancelled" ? (
          <StatusBanner
            tone="warning"
            icon={<XCircle className="h-4 w-4" />}
            text="Stripe checkout was cancelled. You can start payment again when ready."
          />
        ) : null}

        {isConfirming ? (
          <StatusBanner
            tone="info"
            icon={<CreditCard className="h-4 w-4" />}
            text="Verifying your Stripe payment..."
          />
        ) : null}

        {verifiedStripeSession?.id && !isAlreadyPaid ? (
          <StatusBanner
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
            text="Stripe payment verified. Upload the successful payment screenshot to submit your application."
          />
        ) : null}

        {isAlreadyPaid ? (
          <StatusBanner
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
            text="Payment is completed. Your application has been submitted to the university."
          />
        ) : null}

        {localError || checkoutError || confirmError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {localError || checkoutError || confirmError}
          </p>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Secure Stripe Checkout</h3>
              <p className="mt-1 text-sm text-slate-600">
                You will be redirected to Stripe to enter card details. After payment, return here
                and upload the successful payment screenshot before UAAMS submits your application.
              </p>
            </div>
          </div>
        </div>

        {verifiedStripeSession?.id && !isAlreadyPaid ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Successful Payment Screenshot
            </label>
            {paymentProofFileName ? (
              <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Attached: {paymentProofFileName}
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" />
              Upload Screenshot
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event) => handleProofChange(event.target.files?.[0])}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Upload the Stripe success receipt or confirmation screen as PDF, JPG, or PNG.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Application status updates after Stripe payment verification and screenshot upload.
          </p>
          <button
            type="button"
            onClick={
              isAlreadyPaid
                ? () => navigate("/student/applications")
                : verifiedStripeSession?.id
                  ? submitSuccessfulPaymentProof
                  : startStripeCheckout
            }
            disabled={isProcessing || isConfirming}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <CreditCard className="h-4 w-4" />
            {isAlreadyPaid
              ? "View Applications"
              : isProcessing
                ? verifiedStripeSession?.id
                  ? "Submitting..."
                  : "Starting Stripe..."
                : verifiedStripeSession?.id
                  ? "Submit Payment Screenshot"
                  : "Pay with Stripe"}
          </button>
        </div>
      </section>
    </DashboardPageShell>
  );
};

function UniversityPaymentHeader({ application }) {
  const logoUrl = resolveApplicationUniversityLogo(application);
  const universityName = resolveApplicationUniversityName(application);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-100">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${universityName} logo`}
            className="h-full w-full object-cover"
          />
        ) : (
          <School className="h-8 w-8 text-emerald-600" />
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{universityName}</h2>
        <p className="text-sm text-slate-600">{application?.program || "Program"}</p>
      </div>
    </section>
  );
}

function StatusBanner({ tone, icon, text }) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <p className={`inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm ${classes}`}>
      {icon}
      {text}
    </p>
  );
}
