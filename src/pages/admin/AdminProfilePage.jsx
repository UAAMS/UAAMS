import { useEffect, useState } from "react";
import { Save, Upload } from "lucide-react";
import { Avatar } from "../../components/shared/Avatar";
import { useAuth } from "../../context/AuthContext";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { isSupportedProfileImage, isValidEmail, isValidName, isValidPhone } from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearAdminProfileMessages,
  fetchAdminProfile,
  updateAdminProfile,
} from "../../store/slices/adminAccountSlice";

const emptyProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  profilePicture: "",
};

const validateProfile = (profile) => {
  if (!isValidName(profile.name)) return "Enter a valid admin name.";
  if (!isValidEmail(profile.email)) return "Enter a valid email address.";
  if (profile.phone && !isValidPhone(profile.phone)) return "Enter a valid mobile number.";
  return "";
};

export function AdminProfilePage() {
  const dispatch = useAppDispatch();
  const { refreshUser } = useAuth();
  const { profile, loading, loaded, saving, error, message } = useAppSelector(
    (state) => state.adminAccount,
  );
  const [formData, setFormData] = useState(emptyProfile);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!loaded) {
      dispatch(fetchAdminProfile());
    }
  }, [dispatch, loaded]);

  useEffect(() => {
    setFormData({ ...emptyProfile, ...(profile || {}) });
  }, [profile]);

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setLocalError("");
    dispatch(clearAdminProfileMessages());
  };

  const handleImageChange = async (file) => {
    if (!file) return;
    if (!isSupportedProfileImage(file)) {
      setLocalError("Profile picture must be a JPG or PNG file.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField("profilePicture", dataUrl);
    } catch {
      setLocalError("Unable to read selected profile picture.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateProfile(formData);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      await dispatch(updateAdminProfile(formData)).unwrap();
      await refreshUser();
    } catch {
      // API error is rendered from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Admin Profile</h1>
        <p className="uaams-page-description">Manage your admin identity and profile picture.</p>
      </div>

      {localError || error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localError || error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        {loading ? (
          <p className="text-sm text-slate-600">Loading profile...</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
              <Avatar src={formData.profilePicture} name={formData.name} size="xl" />
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Profile Picture
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                  <Upload className="h-4 w-4" />
                  Upload JPG/PNG
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleImageChange(file);
                      if (file && !isSupportedProfileImage(file)) {
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={formData.name} onChange={(value) => updateField("name", value)} required />
              <Field label="Email" type="email" value={formData.email} onChange={(value) => updateField("email", value)} required />
              <Field label="Phone" value={formData.phone} onChange={(value) => updateField("phone", value)} />
              <Field label="Location" value={formData.location} onChange={(value) => updateField("location", value)} />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-700">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
