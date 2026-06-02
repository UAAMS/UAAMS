import { useEffect, useState } from "react";
import { Pencil, Save, Upload, X } from "lucide-react";
import { Avatar } from "../shared/Avatar";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import {
  alphabeticNameInputPattern,
  emailPattern,
  isNumberInRange,
  isSupportedProfileImage,
  isValidEmail,
  isValidName,
  isValidPhone,
  sanitizeAlphabeticNameInput,
} from "../../lib/validation";
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
  representativeProfilePicture: "",
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

const isValidUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return true;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const isValidOrganizationName = (value) =>
  /^[A-Za-z][A-Za-z0-9 .,'&()/-]{2,159}$/.test(String(value || "").trim());

const validateSettings = (settings) => {
  if (!isValidOrganizationName(settings.universityName)) {
    return "Enter a valid university name.";
  }

  if (!isValidEmail(settings.email)) {
    return "Enter a valid university email address.";
  }

  if (settings.phone && !isValidPhone(settings.phone)) {
    return "Enter a valid university mobile number.";
  }

  if (settings.website && !isValidUrl(settings.website)) {
    return "Enter a valid website URL starting with http:// or https://.";
  }

  if (settings.established && !isNumberInRange(settings.established, 1800, new Date().getFullYear())) {
    return "Established year must be a valid year.";
  }

  if (settings.totalStudents && !isNumberInRange(settings.totalStudents, 0, 1000000)) {
    return "Total students must be a valid number.";
  }

  if (settings.totalPrograms && !isNumberInRange(settings.totalPrograms, 0, 10000)) {
    return "Total programs must be a valid number.";
  }

  if (settings.representativeName && !isValidName(settings.representativeName)) {
    return "Representative name can contain alphabetic letters and spaces only.";
  }

  if (settings.representativeEmail && !isValidEmail(settings.representativeEmail)) {
    return "Enter a valid representative email address.";
  }

  if (settings.representativePhone && !isValidPhone(settings.representativePhone)) {
    return "Enter a valid representative mobile number.";
  }

  return "";
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
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    dispatch(fetchUniversitySettings());
  }, [dispatch]);

  useEffect(() => {
    setFormData(storedSettings || defaultSettings);
  }, [storedSettings]);

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    dispatch(clearUniversityAccountMessages());
    setLocalError("");
  };

  const handleImageUpload = async (file, field, errorLabel) => {
    if (!file) return;
    if (!isSupportedProfileImage(file)) {
      setLocalError(`${errorLabel} must be a JPG or PNG file.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField(field, dataUrl);
    } catch {
      setLocalError(`Unable to read selected ${errorLabel.toLowerCase()}.`);
    }
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
    if (!isEditing) return;

    const validationError = validateSettings(formData);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      await dispatch(updateUniversitySettings(formData)).unwrap();
      setIsEditing(false);
    } catch {}
  };

  const handleCancel = () => {
    setFormData(storedSettings || defaultSettings);
    setIsEditing(false);
    setLocalError("");
    dispatch(clearUniversityAccountMessages());
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="uaams-page-title">University Settings</h1>
          <p className="uaams-page-description">Loading saved settings...</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Fetching configuration...
        </div>
      </div>
    );
  }

  const isFormDisabled = isSaving || !isEditing;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <h1 className="uaams-page-title">University Settings</h1>
        <p className="uaams-page-description">
          Manage university profile and preferences. Programs are managed in Form & Programs page.
        </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" />
            Edit Settings
          </button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              form="university-settings-form"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      {localError || error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localError || error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <form id="university-settings-form" onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="uaams-section-title mb-4">Basic Information</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="University Name"
              value={formData.universityName}
              onChange={(value) => updateField("universityName", value)}
              disabled={isFormDisabled}
              required
            />
            <Field
              label="Short Name"
              value={formData.shortName}
              onChange={(value) => updateField("shortName", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Email"
              type="email"
              value={formData.email}
              onChange={(value) => updateField("email", value)}
              disabled={isFormDisabled}
              required
            />
            <Field
              label="Phone"
              value={formData.phone}
              onChange={(value) => updateField("phone", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Website"
              type="url"
              value={formData.website}
              onChange={(value) => updateField("website", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Established"
              value={formData.established}
              onChange={(value) => updateField("established", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="City"
              value={formData.city}
              onChange={(value) => updateField("city", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Province"
              value={formData.province}
              onChange={(value) => updateField("province", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Postal Code"
              value={formData.postalCode}
              onChange={(value) => updateField("postalCode", value)}
              disabled={isFormDisabled}
            />
            <div>
              <label className="mb-2 block text-sm text-slate-700">Type</label>
              <select
                value={formData.type}
                onChange={(event) => updateField("type", event.target.value)}
                disabled={isFormDisabled}
                className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              disabled={isFormDisabled}
              className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar
                src={formData.logo}
                name={formData.shortName || formData.universityName || "University"}
                size="lg"
                className="rounded-lg bg-white"
              />
              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-700">University Logo</label>
                <input
                  type="url"
                  value={formData.logo}
                  onChange={(event) => updateField("logo", event.target.value)}
                  disabled={isFormDisabled}
                  className="uaams-disabled-control mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
                <label
                  className={`inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 ${
                    isFormDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-blue-100"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    disabled={isFormDisabled}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleImageUpload(file, "logo", "University logo");
                      if (file && !isSupportedProfileImage(file)) {
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="uaams-section-title mb-4">University Profile</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Field
              label="Total Students"
              value={formData.totalStudents}
              onChange={(value) => updateField("totalStudents", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Total Programs"
              value={formData.totalPrograms}
              onChange={(value) => updateField("totalPrograms", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Ranking"
              value={formData.ranking}
              onChange={(value) => updateField("ranking", value)}
              disabled
            />
          </div>
          <div className="mt-4">
            <Field
              label="Accreditation"
              value={formData.accreditation}
              onChange={(value) => updateField("accreditation", value)}
              disabled={isFormDisabled}
            />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-700">About</label>
            <textarea
              rows={3}
              value={formData.about}
              onChange={(event) => updateField("about", event.target.value)}
              disabled={isFormDisabled}
              className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm text-slate-700">Mission</label>
              <textarea
                rows={3}
                value={formData.mission}
                onChange={(event) => updateField("mission", event.target.value)}
                disabled={isFormDisabled}
                className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-700">Vision</label>
              <textarea
                rows={3}
                value={formData.vision}
                onChange={(event) => updateField("vision", event.target.value)}
                disabled={isFormDisabled}
                className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="uaams-section-title mb-4">Admission Office Contact</h3>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar
                src={formData.representativeProfilePicture}
                name={formData.representativeName || "Representative"}
                size="lg"
                className="bg-white"
              />
              <div className="flex-1">
                <label className="mb-2 block text-sm text-slate-700">
                  Representative Profile Picture
                </label>
                <label
                  className={`inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 ${
                    isFormDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-blue-100"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload Picture
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    disabled={isFormDisabled}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleImageUpload(
                        file,
                        "representativeProfilePicture",
                        "Representative profile picture",
                      );
                      if (file && !isSupportedProfileImage(file)) {
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Representative Name"
              value={formData.representativeName}
              onChange={(value) => updateField("representativeName", value)}
              disabled={isFormDisabled}
              alphaOnly
            />
            <Field
              label="Representative Position"
              value={formData.representativePosition}
              onChange={(value) => updateField("representativePosition", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Representative Email"
              type="email"
              value={formData.representativeEmail}
              onChange={(value) => updateField("representativeEmail", value)}
              disabled={isFormDisabled}
            />
            <Field
              label="Representative Phone"
              value={formData.representativePhone}
              onChange={(value) => updateField("representativePhone", value)}
              disabled={isFormDisabled}
            />
          </div>
        </section>
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
  disabled = false,
  alphaOnly = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(alphaOnly ? sanitizeAlphabeticNameInput(event.target.value) : event.target.value)
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        pattern={type === "email" ? emailPattern.source : alphaOnly ? alphabeticNameInputPattern.source : undefined}
        title={
          type === "email"
            ? "Enter a valid email address."
            : alphaOnly
              ? "Use alphabetic letters and spaces only."
              : undefined
        }
        className="uaams-disabled-control w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
