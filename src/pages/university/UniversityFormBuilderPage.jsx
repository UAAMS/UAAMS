import { useEffect } from "react";
import { FormBuilder } from "../../components/university/FormBuilder";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchUniversityFormSetup,
  saveUniversityFormFields,
} from "../../store/slices/universityFormSetupSlice";

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

export const UniversityFormBuilderPage = () => {
  const dispatch = useAppDispatch();
  const { fields, savedAt, loading: isLoading, error: loadError, saveError } = useAppSelector(
    (state) => state.universityFormSetup,
  );
  const error = saveError || loadError;

  useEffect(() => {
    dispatch(fetchUniversityFormSetup());
  }, [dispatch]);

  const handleSave = async (nextFields) => {
    try {
      await dispatch(saveUniversityFormFields(nextFields)).unwrap();
    } catch (saveError) {
      const message =
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to save form configuration.";
      throw new Error(message);
    }
  };

  if (isLoading) {
    return (
      <DashboardPageShell
        title="Dynamic Form Builder"
        subtitle="Design custom admission forms and save each revision instantly."
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading saved form configuration...
        </div>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell
      title="Dynamic Form Builder"
      subtitle="Design custom admission forms and save each revision instantly."
      actions={
        savedAt ? (
          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Saved: {formatDateTime(savedAt)}
          </span>
        ) : null
      }
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <FormBuilder
        onSave={handleSave}
        initialFields={fields}
      />
    </DashboardPageShell>
  );
};
