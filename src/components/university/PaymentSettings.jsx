import { useEffect, useState } from "react";
import { Landmark, Plus, Save, Trash2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearUniversityAccountMessages,
  fetchUniversitySettings,
  updateUniversitySettings,
} from "../../store/slices/universityAccountSlice";

const emptyPaymentMethod = () => ({
  id: `${Date.now()}`,
  type: "bank",
  title: "",
  accountTitle: "",
  bankName: "",
  accountNumber: "",
  iban: "",
  walletName: "",
  walletNumber: "",
  instructions: "",
  isActive: true,
});

const normalizeMethods = (methods = []) =>
  Array.isArray(methods) && methods.length > 0 ? methods : [emptyPaymentMethod()];

export function PaymentSettings() {
  const dispatch = useAppDispatch();
  const {
    data: storedSettings,
    loading: isLoading,
    saving: isSaving,
    error: loadError,
    saveError,
    successMessage,
  } = useAppSelector((state) => state.universityAccount.settings);

  const [paymentMethods, setPaymentMethods] = useState([emptyPaymentMethod()]);
  const [localError, setLocalError] = useState("");
  const error = localError || saveError || loadError;

  useEffect(() => {
    dispatch(fetchUniversitySettings());
  }, [dispatch]);

  useEffect(() => {
    setPaymentMethods(normalizeMethods(storedSettings?.paymentMethods));
  }, [storedSettings?.paymentMethods]);

  const updateMethod = (id, field, value) => {
    setPaymentMethods((previous) =>
      previous.map((method) => (method.id === id ? { ...method, [field]: value } : method)),
    );
    dispatch(clearUniversityAccountMessages());
    setLocalError("");
  };

  const addMethod = () => {
    setPaymentMethods((previous) => [...previous, emptyPaymentMethod()]);
    dispatch(clearUniversityAccountMessages());
    setLocalError("");
  };

  const removeMethod = (id) => {
    setPaymentMethods((previous) =>
      previous.length === 1 ? [emptyPaymentMethod()] : previous.filter((method) => method.id !== id),
    );
    dispatch(clearUniversityAccountMessages());
    setLocalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");
    const cleanedMethods = paymentMethods
      .map((method) => ({
        ...method,
        title: method.title.trim(),
        accountTitle: method.accountTitle.trim(),
        bankName: method.bankName.trim(),
        accountNumber: method.accountNumber.trim(),
        iban: method.iban.trim(),
        walletName: method.walletName.trim(),
        walletNumber: method.walletNumber.trim(),
        instructions: method.instructions.trim(),
      }))
      .filter(
        (method) =>
          method.title ||
          method.accountTitle ||
          method.bankName ||
          method.accountNumber ||
          method.iban ||
          method.walletName ||
          method.walletNumber ||
          method.instructions,
      );

    const invalidMethod = cleanedMethods.find((method) => {
      if (!method.title) return true;
      if (method.type === "bank") {
        return (
          !method.accountTitle ||
          !method.bankName ||
          !/^[A-Za-z0-9 -]{6,40}$/.test(method.accountNumber) ||
          (method.iban && !/^PK[0-9A-Z]{2}[0-9A-Z]{16,30}$/i.test(method.iban.replace(/\s+/g, "")))
        );
      }
      if (method.type === "wallet") {
        return !method.walletName || !/^(\+92|0)?[ -]?3\d{2}[ -]?\d{7}$/.test(method.walletNumber);
      }
      return !method.accountNumber && !method.instructions;
    });

    if (invalidMethod) {
      setLocalError(
        "Please complete each payment method with valid account, IBAN, or wallet details.",
      );
      return;
    }

    try {
      const payload = { ...storedSettings, paymentMethods: cleanedMethods };
      delete payload.universityName;
      await dispatch(updateUniversitySettings(payload)).unwrap();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Payment Details</h1>
        <p className="uaams-page-description">
          Add the bank or wallet details students should use before uploading payment proof.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading payment details...
        </div>
      ) : null}

      {!isLoading ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <Landmark className="h-5 w-5" />
                </div>
                <h3 className="text-slate-900">Accepted Payment Methods</h3>
              </div>
              <button
                type="button"
                onClick={addMethod}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add Method
              </button>
            </div>

            <div className="space-y-4">
              {paymentMethods.map((method, index) => (
                <PaymentMethodEditor
                  key={method.id}
                  method={method}
                  index={index}
                  onChange={updateMethod}
                  onRemove={removeMethod}
                />
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Payment Details"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function PaymentMethodEditor({ method, index, onChange, onRemove }) {
  const isBank = method.type === "bank";
  const isWallet = method.type === "wallet";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-700">Method {index + 1}</div>
        <button
          type="button"
          onClick={() => onRemove(method.id)}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-slate-700">Method Type</label>
          <select
            value={method.type}
            onChange={(event) => onChange(method.id, "type", event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="bank">Bank Transfer</option>
            <option value="wallet">Mobile Wallet</option>
            <option value="card">Card / Online Portal</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Field
          label="Display Title"
          value={method.title}
          onChange={(value) => onChange(method.id, "title", value)}
          placeholder="e.g. HBL Admission Fee Account"
        />
        <Field
          label="Account Title"
          value={method.accountTitle}
          onChange={(value) => onChange(method.id, "accountTitle", value)}
          placeholder="e.g. ABC University"
        />
        {isBank ? (
          <>
            <Field
              label="Bank Name"
              value={method.bankName}
              onChange={(value) => onChange(method.id, "bankName", value)}
              placeholder="e.g. Habib Bank Limited"
            />
            <Field
              label="Account Number"
              value={method.accountNumber}
              onChange={(value) => onChange(method.id, "accountNumber", value)}
              placeholder="e.g. 1234-567890-01"
            />
            <Field
              label="IBAN"
              value={method.iban}
              onChange={(value) => onChange(method.id, "iban", value)}
              placeholder="e.g. PK00..."
            />
          </>
        ) : null}
        {isWallet ? (
          <>
            <Field
              label="Wallet Name"
              value={method.walletName}
              onChange={(value) => onChange(method.id, "walletName", value)}
              placeholder="e.g. JazzCash"
            />
            <Field
              label="Wallet Number"
              value={method.walletNumber}
              onChange={(value) => onChange(method.id, "walletNumber", value)}
              placeholder="e.g. 03xx..."
            />
          </>
        ) : null}
        {!isBank && !isWallet ? (
          <Field
            label="Reference / Account Detail"
            value={method.accountNumber}
            onChange={(value) => onChange(method.id, "accountNumber", value)}
            placeholder="Portal URL, merchant ID, or account reference"
          />
        ) : null}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm text-slate-700">Instructions</label>
        <textarea
          rows={3}
          value={method.instructions}
          onChange={(event) => onChange(method.id, "instructions", event.target.value)}
          placeholder="Mention branch code, fee challan instructions, or screenshot requirements."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={method.isActive}
          onChange={(event) => onChange(method.id, "isActive", event.target.checked)}
          className="rounded border-slate-300"
        />
        Show this method to students
      </label>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
