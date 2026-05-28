import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, School, Upload } from "lucide-react";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { isSupportedDocumentFile, isValidTransactionReference } from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentApplications } from "../../store/slices/applicationsSlice";
import {
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
  const {
    currentApplication: application,
    loading: isLoading,
    error: loadError,
    processing: isProcessing,
    processingError,
  } = useAppSelector((state) => state.payments);

  const [paymentData, setPaymentData] = useState({
    method: "bank",
    accountNumber: "",
    transactionReference: "",
    paymentProof: "",
    paymentProofFileName: "",
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchPaymentApplication(applicationId));
    return () => {
      dispatch(resetPaymentState());
    };
  }, [dispatch, applicationId]);

  useEffect(() => {
    if (processingError) {
      setApiError(processingError);
    }
  }, [processingError]);

  const isAlreadyPaid = useMemo(
    () => application?.payment?.status === "paid",
    [application?.payment?.status],
  );

  const paymentMethods = useMemo(
    () =>
      Array.isArray(application?.paymentMethods)
        ? application.paymentMethods.filter((method) => method?.isActive !== false)
        : [],
    [application?.paymentMethods],
  );

  useEffect(() => {
    if (paymentMethods.length === 0) return;
    setPaymentData((previous) => ({
      ...previous,
      method: previous.method || paymentMethods[0].type || "bank",
    }));
  }, [paymentMethods]);

  const applicationUniversityId = useMemo(
    () => application?.university?._id || application?.university?.id || application?.university,
    [application],
  );

  const hasUniversityMismatch = useMemo(
    () =>
      Boolean(
        application &&
          applicationUniversityId &&
          String(applicationUniversityId) !== String(universityId),
      ),
    [application, applicationUniversityId, universityId],
  );

  const effectiveLoadError = hasUniversityMismatch
    ? "Application does not match selected university."
    : loadError;

  const handleChange = (field, value) => {
    setPaymentData((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: "" }));
    }
    if (apiError) {
      setApiError("");
    }
  };

  const handleProofChange = async (file) => {
    if (!file) return;
    if (!isSupportedDocumentFile(file)) {
      setErrors((previous) => ({
        ...previous,
        paymentProof: "Payment proof must be a PDF, JPG, or PNG file.",
      }));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      handleChange("paymentProof", dataUrl);
      handleChange("paymentProofFileName", file.name);
    } catch (fileError) {
      setApiError(fileError?.message || "Unable to read payment screenshot.");
    }
  };

  const handlePayAndSubmit = async (event) => {
    event.preventDefault();
    setApiError("");

    const nextErrors = {};

    if (!isValidTransactionReference(paymentData.transactionReference)) {
      nextErrors.transactionReference =
        "Enter a valid transaction reference (6-64 letters, numbers, dots, dashes, slashes, or underscores).";
    }

    if (
      paymentData.accountNumber.trim() &&
      !/^[A-Za-z0-9 +._/-]{4,40}$/.test(paymentData.accountNumber.trim())
    ) {
      nextErrors.accountNumber = "Enter a valid sender account or wallet number.";
    }

    if (!paymentData.paymentProof.trim()) {
      nextErrors.paymentProof = "Payment screenshot is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setConfirmOpen(true);
  };

  const submitConfirmedPayment = async () => {
    setConfirmOpen(false);

    if (!application?._id) {
      setApiError("Application draft not found.");
      return;
    }

    try {
      await dispatch(
        submitApplicationPayment({
          applicationId: application._id,
          payload: {
            method: paymentData.method,
            accountNumber: paymentData.accountNumber,
            transactionReference: paymentData.transactionReference,
            paymentProof: paymentData.paymentProof,
            paymentProofFileName: paymentData.paymentProofFileName,
          },
        }),
      ).unwrap();
      dispatch(fetchStudentApplications());
      navigate("/student/applications");
    } catch (error) {
      setApiError(error?.message || "Unable to submit application payment.");
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
              `/student/apply/${universityId}?program=${encodeURIComponent(
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
      <form
        onSubmit={handlePayAndSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="rounded-lg bg-emerald-50 px-4 py-4 text-base text-emerald-800">
          <p className="font-semibold">Application Fee</p>
          <p className="mt-1 text-2xl font-semibold sm:text-3xl">
            PKR {Number(application?.payment?.amount || 0).toLocaleString()}
          </p>
        </div>

        {isAlreadyPaid ? (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Payment is already completed for this application.
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm text-slate-900">University Payment Details</h3>
          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method, index) => (
                <PaymentMethodCard key={method.id || index} method={method} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              The university has not added payment instructions yet. Contact the admission office
              before submitting proof.
            </p>
          )}
        </section>

        <div>
          <label className="mb-2 block text-sm text-slate-700">Payment Method</label>
          <select
            value={paymentData.method}
            onChange={(event) => handleChange("method", event.target.value)}
            disabled={isAlreadyPaid}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
          >
            <option value="bank">Bank Transfer</option>
            <option value="wallet">Mobile Wallet</option>
            <option value="card">Debit / Credit Card</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-700">Your Account / Sender Number</label>
          <input
            type="text"
            value={paymentData.accountNumber}
            onChange={(event) => handleChange("accountNumber", event.target.value)}
            placeholder="Optional sender account, card, or wallet number"
            disabled={isAlreadyPaid}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 ${
              errors.accountNumber ? "border-red-500" : "border-slate-300"
            }`}
          />
          {errors.accountNumber ? (
            <p className="mt-1 text-xs text-red-600">{errors.accountNumber}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-700">Transaction Reference</label>
          <input
            type="text"
            value={paymentData.transactionReference}
            onChange={(event) => handleChange("transactionReference", event.target.value)}
            placeholder="e.g. TXN-4582231"
            disabled={isAlreadyPaid}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 ${
              errors.transactionReference ? "border-red-500" : "border-slate-300"
            }`}
          />
          {errors.transactionReference ? (
            <p className="mt-1 text-xs text-red-600">{errors.transactionReference}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-700">Payment Screenshot</label>
          <div
            className={`rounded-lg border bg-white px-3 py-3 text-sm ${
              errors.paymentProof ? "border-red-500" : "border-slate-300"
            }`}
          >
            {paymentData.paymentProofFileName ? (
              <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Attached: {paymentData.paymentProofFileName}
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50">
              <Upload className="h-5 w-5 shrink-0" />
              Upload Screenshot
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={isAlreadyPaid}
                onChange={(event) => handleProofChange(event.target.files?.[0])}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">Upload a PDF, JPG, or PNG receipt.</p>
          </div>
          {errors.paymentProof ? (
            <p className="mt-1 text-xs text-red-600">{errors.paymentProof}</p>
          ) : null}
        </div>

        {apiError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{apiError}</p>
        ) : null}

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Your draft will be marked submitted after successful payment.
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button
            type="submit"
            disabled={isProcessing || isAlreadyPaid}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <CreditCard className="h-4 w-4" />
            {isAlreadyPaid ? "Already Paid" : isProcessing ? "Processing..." : "Pay & Submit Application"}
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={isConfirmOpen}
        title="Submit payment?"
        description="This will submit your payment proof and move the application from draft to submitted."
        confirmLabel="Submit Payment"
        tone="success"
        isLoading={isProcessing}
        onConfirm={submitConfirmedPayment}
        onCancel={() => setConfirmOpen(false)}
      />
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

function PaymentMethodCard({ method }) {
  const details = [
    method.accountTitle ? `Account Title: ${method.accountTitle}` : "",
    method.bankName ? `Bank: ${method.bankName}` : "",
    method.accountNumber ? `Account: ${method.accountNumber}` : "",
    method.iban ? `IBAN: ${method.iban}` : "",
    method.walletName ? `Wallet: ${method.walletName}` : "",
    method.walletNumber ? `Wallet Number: ${method.walletNumber}` : "",
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
          {method.type || "bank"}
        </span>
        <h4 className="text-sm text-slate-900">{method.title || "Payment Method"}</h4>
      </div>
      {details.length > 0 ? (
        <div className="mt-2 grid gap-1 text-xs text-slate-700 md:grid-cols-2">
          {details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      ) : null}
      {method.instructions ? (
        <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{method.instructions}</p>
      ) : null}
    </div>
  );
}
