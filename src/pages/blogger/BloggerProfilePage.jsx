import { useEffect, useState } from "react";
import { Save, Upload } from "lucide-react";
import { Avatar } from "../../components/shared/Avatar";
import { useAuth } from "../../context/AuthContext";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import {
  isSupportedProfileImage,
  isValidEmail,
  isValidName,
  isValidPhone,
} from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearBloggerProfileMessages,
  fetchBloggerProfile,
  updateBloggerProfile,
} from "../../store/slices/bloggerAccountSlice";

const emptyProfile = {
  name: "",
  email: "",
  username: "",
  phone: "",
  location: "",
  website: "",
  profilePicture: "",
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

const validateProfile = (profile) => {
  if (!isValidName(profile.name)) return "Enter a valid blogger name.";
  if (!isValidEmail(profile.email)) return "Enter a valid email address.";
  if (!String(profile.username || "").trim()) return "Username is required.";
  if (profile.phone && !isValidPhone(profile.phone)) return "Enter a valid mobile number.";
  if (profile.website && !isValidUrl(profile.website)) {
    return "Website must start with http:// or https://.";
  }
  return "";
};

export function BloggerProfilePage() {
  const dispatch = useAppDispatch();
  const { refreshUser } = useAuth();
  const {
    profile,
    profileLoading,
    profileSaving,
    profileLoaded,
    profileError,
    profileMessage,
  } = useAppSelector((state) => state.bloggerAccount);
  const [formData, setFormData] = useState(emptyProfile);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!profileLoaded) {
      dispatch(fetchBloggerProfile());
    }
  }, [dispatch, profileLoaded]);

  useEffect(() => {
    setFormData({ ...emptyProfile, ...(profile || {}) });
  }, [profile]);

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setLocalError("");
    dispatch(clearBloggerProfileMessages());
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
      await dispatch(updateBloggerProfile(formData)).unwrap();
      await refreshUser();
    } catch {
      // Slice renders the API error.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Blogger Profile</h1>
        <p className="uaams-page-description">Manage your public blogger identity.</p>
      </div>

      {localError || profileError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localError || profileError}
        </p>
      ) : null}

      {profileMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {profileMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        {profileLoading ? (
          <p className="text-sm text-slate-600">Loading profile...</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
              <Avatar src={formData.profilePicture} name={formData.name} size="xl" />
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Profile Picture
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100">
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
                <p className="mt-2 text-xs text-slate-500">
                  This picture appears beside your blog posts on the student side.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" value={formData.name} onChange={(value) => updateField("name", value)} required />
              <Field label="Username" value={formData.username} onChange={(value) => updateField("username", value)} required />
              <Field label="Email" type="email" value={formData.email} onChange={(value) => updateField("email", value)} required />
              <Field label="Phone" value={formData.phone} onChange={(value) => updateField("phone", value)} />
              <Field label="Location" value={formData.location} onChange={(value) => updateField("location", value)} />
              <Field label="Website" type="url" value={formData.website} onChange={(value) => updateField("website", value)} />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                {profileSaving ? "Saving..." : "Save Profile"}
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
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}
