import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearUniversityAccountMessages,
  fetchUniversitySettings,
  updateUniversitySettings,
} from "../../store/slices/universityAccountSlice";

const defaultSettings = {
  universityName: "",
  shortName: "",
  type: "public",
  established: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  about: "",
  mission: "",
  vision: "",
  totalStudents: "",
  totalPrograms: "",
  ranking: "",
  accreditation: "HEC",
  representativeName: "",
  representativePosition: "",
  representativeEmail: "",
  representativePhone: "",
  logo: "",
  applicationFee: "0",
  applicationStartDate: "",
  applicationEndDate: "",
  acceptApplicationsThroughUaams: true,
  allowAutoFillFromStudentProfile: true,
  paymentMethods: [],
  notifications: {
    emailOnNewApplication: true,
    dailySummary: true,
    smsUrgentUpdates: false,
  },
};

function UniversitySettings() {
  const dispatch = useAppDispatch();
  const {
    data: storedSettings,
    loading: isLoading,
    saving: isSaving,
    error: loadError,
    saveError,
    successMessage,
  } = useAppSelector((state) => state.universityAccount.settings);
  const error = saveError || loadError;

  const [formData, setFormData] = useState(defaultSettings);

  useEffect(() => {
    dispatch(fetchUniversitySettings());
  }, [dispatch]);

  useEffect(() => {
    setFormData(storedSettings || defaultSettings);
  }, [storedSettings]);

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    dispatch(clearUniversityAccountMessages());
  };

  const updateNotification = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      notifications: {
        ...previous.notifications,
        [field]: value,
      },
    }));
    dispatch(clearUniversityAccountMessages());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await dispatch(updateUniversitySettings(formData)).unwrap();
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-slate-900 mb-2">University Settings</h1>
          <p className="text-slate-600">Loading saved settings...</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Fetching configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-900 mb-2">University Settings</h1>
        <p className="text-slate-600">
          Manage university profile and preferences. Programs are managed in Form & Programs page.
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-slate-900 mb-4">Basic Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="University Name"
              value={formData.universityName}
              onChange={(value) => updateField("universityName", value)}
              required
            />
            <Field
              label="Short Name"
              value={formData.shortName}
              onChange={(value) => updateField("shortName", value)}
            />
            <Field
              label="Email"
              type="email"
              value={formData.email}
              onChange={(value) => updateField("email", value)}
              required
            />
            <Field
              label="Phone"
              value={formData.phone}
              onChange={(value) => updateField("phone", value)}
            />
            <Field
              label="Website"
              type="url"
              value={formData.website}
              onChange={(value) => updateField("website", value)}
            />
            <Field
              label="Established"
              value={formData.established}
              onChange={(value) => updateField("established", value)}
            />
            <Field
              label="City"
              value={formData.city}
              onChange={(value) => updateField("city", value)}
            />
            <Field
              label="Province"
              value={formData.province}
              onChange={(value) => updateField("province", value)}
            />
            <Field
              label="Postal Code"
              value={formData.postalCode}
              onChange={(value) => updateField("postalCode", value)}
            />
            <div>
              <label className="mb-2 block text-sm text-slate-700">Type</label>
              <select
                value={formData.type}
                onChange={(event) => updateField("type", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-700">Address</label>
            <textarea
              rows={3}
              value={formData.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-700">Logo URL</label>
            <input
              type="url"
              value={formData.logo}
              onChange={(event) => updateField("logo", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-slate-900 mb-4">University Profile</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Field
              label="Total Students"
              value={formData.totalStudents}
              onChange={(value) => updateField("totalStudents", value)}
            />
            <Field
              label="Total Programs"
              value={formData.totalPrograms}
              onChange={(value) => updateField("totalPrograms", value)}
            />
            <Field
              label="Ranking"
              value={formData.ranking}
              onChange={(value) => updateField("ranking", value)}
            />
          </div>
          <div className="mt-4">
            <Field
              label="Accreditation"
              value={formData.accreditation}
              onChange={(value) => updateField("accreditation", value)}
            />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-700">About</label>
            <textarea
              rows={3}
              value={formData.about}
              onChange={(event) => updateField("about", event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm text-slate-700">Mission</label>
              <textarea
                rows={3}
                value={formData.mission}
                onChange={(event) => updateField("mission", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-700">Vision</label>
              <textarea
                rows={3}
                value={formData.vision}
                onChange={(event) => updateField("vision", event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-slate-900 mb-4">Admission Settings</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Field
              label="Application Start Date"
              type="date"
              value={formData.applicationStartDate}
              onChange={(value) => updateField("applicationStartDate", value)}
            />
            <Field
              label="Application End Date"
              type="date"
              value={formData.applicationEndDate}
              onChange={(value) => updateField("applicationEndDate", value)}
            />
            <Field
              label="Application Fee (PKR)"
              type="number"
              value={formData.applicationFee}
              onChange={(value) => updateField("applicationFee", value)}
            />
          </div>
          <div className="mt-4 space-y-3">
            <CheckboxField
              label="Accept applications through UAAMS"
              checked={formData.acceptApplicationsThroughUaams}
              onChange={(value) => updateField("acceptApplicationsThroughUaams", value)}
            />
            <CheckboxField
              label="Allow auto-fill from student profile"
              checked={formData.allowAutoFillFromStudentProfile}
              onChange={(value) => updateField("allowAutoFillFromStudentProfile", value)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-slate-900 mb-4">Admission Office Contact</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Representative Name"
              value={formData.representativeName}
              onChange={(value) => updateField("representativeName", value)}
            />
            <Field
              label="Representative Position"
              value={formData.representativePosition}
              onChange={(value) => updateField("representativePosition", value)}
            />
            <Field
              label="Representative Email"
              type="email"
              value={formData.representativeEmail}
              onChange={(value) => updateField("representativeEmail", value)}
            />
            <Field
              label="Representative Phone"
              value={formData.representativePhone}
              onChange={(value) => updateField("representativePhone", value)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-slate-900 mb-4">Notification Preferences</h3>
          <div className="space-y-3">
            <CheckboxField
              label="Email on new application"
              checked={formData.notifications.emailOnNewApplication}
              onChange={(value) => updateNotification("emailOnNewApplication", value)}
            />
            <CheckboxField
              label="Daily summary"
              checked={formData.notifications.dailySummary}
              onChange={(value) => updateNotification("dailySummary", value)}
            />
            <CheckboxField
              label="SMS for urgent updates"
              checked={formData.notifications.smsUrgentUpdates}
              onChange={(value) => updateNotification("smsUrgentUpdates", value)}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        className="rounded border-slate-300"
      />
      {label}
    </label>
  );
}

export { UniversitySettings };
