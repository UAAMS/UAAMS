import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const isDanger = tone === "danger";
  const Icon = isDanger ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel?.();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDanger ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id="confirm-dialog-description" className="mt-1 text-sm text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-70 ${
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isLoading ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
