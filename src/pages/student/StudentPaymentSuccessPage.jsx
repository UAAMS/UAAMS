import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, School } from "lucide-react";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  confirmStripeCheckoutSession,
  fetchPaymentApplication,
  resetPaymentState,
} from "../../store/slices/paymentsSlice";

const resolveUniversityName = (application) =>
  application?.universityProfile?.universityName ||
  application?.university?.name ||
  "University";

const resolveStudentName = (application) =>
  application?.studentName ||
  application?.student?.name ||
  "Student";

export const StudentPaymentSuccessPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const { currentApplication: application, loading, error, confirming, confirmError } = useAppSelector(
    (state) => state.payments,
  );
  const [stripeSession, setStripeSession] = useState(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    dispatch(fetchPaymentApplication(applicationId));
    return () => {
      dispatch(resetPaymentState());
    };
  }, [applicationId, dispatch]);

  useEffect(() => {
    if (!applicationId || !sessionId || stripeSession?.id === sessionId) return;

    dispatch(confirmStripeCheckoutSession({ applicationId, sessionId }))
      .unwrap()
      .then((payload) => {
        if (payload?.stripeSession?.paymentStatus === "paid") {
          setStripeSession(payload.stripeSession);
          return;
        }
        setLocalError("Stripe payment is not marked as paid yet.");
      })
      .catch((failure) => {
        setLocalError(
          typeof failure === "string"
            ? failure
            : failure?.message || "Unable to verify Stripe payment.",
        );
      });
  }, [applicationId, dispatch, sessionId, stripeSession?.id]);

  const receiptRows = useMemo(
    () => [
      { label: "Student Name", value: resolveStudentName(application) },
      { label: "Application ID", value: application?.applicationCode || applicationId },
      { label: "University Name", value: resolveUniversityName(application) },
      {
        label: "Transaction Reference",
        value: stripeSession?.paymentIntentId || stripeSession?.id || sessionId || "Pending",
      },
      { label: "Stripe Session ID", value: stripeSession?.id || sessionId || "Pending" },
    ],
    [application, applicationId, sessionId, stripeSession],
  );

  const proceedToScreenshotUpload = () => {
    const target = `/student/payment/${applicationId}?stripe=success&session_id=${encodeURIComponent(
      stripeSession?.id || sessionId,
    )}`;
    window.location.assign(target);
  };

  const pageError = localError || confirmError || error;

  return (
    <DashboardPageShell
      title="Payment Successful"
      subtitle="Take a screenshot of this receipt before proceeding"
      actions={
        <button
          type="button"
          onClick={() => navigate("/student/applications")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Back to Applications
        </button>
      }
    >
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Stripe Payment Received</h2>
            <p className="mt-1 text-sm text-slate-600">
              Capture this page as proof, then continue to upload that screenshot.
            </p>
          </div>
        </div>

        {loading || confirming ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Verifying payment details...
          </p>
        ) : null}

        {pageError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pageError}
          </p>
        ) : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Payment Receipt
          </div>
          <div className="grid gap-3">
            {receiptRows.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 rounded-lg bg-white px-3 py-2 sm:grid-cols-[180px_1fr]"
              >
                <span className="text-xs font-medium uppercase text-slate-500">{row.label}</span>
                <span className="break-all text-sm font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center">
          <School className="h-5 w-5 shrink-0" />
          Take a screenshot of this receipt. You will upload it on the next screen.
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={proceedToScreenshotUpload}
            disabled={!sessionId || confirming}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Proceed to Screenshot Upload
          </button>
        </div>
      </section>
    </DashboardPageShell>
  );
};
