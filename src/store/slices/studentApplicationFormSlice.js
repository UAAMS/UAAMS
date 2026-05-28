import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";
import { defaultApplicationFields } from "../../data/universityRecommendationsData";

const normalizeUniversity = (university = {}) => {
  const rawPrograms = Array.isArray(university?.programs) ? university.programs : [];
  const programDetails = rawPrograms
    .map((program) => ({
      name: String(program?.name || "").trim(),
      requiredAggregate: Number(program?.requiredAggregate || 0),
      seats: Number(program?.seats || 0),
      feeRange: String(program?.feeRange || "").trim(),
      deadlineDate: program?.deadlineDate || null,
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    }))
    .filter((program) => program.name);

  return {
    id: String(university?.id || university?._id || ""),
    name: university?.name || "University",
    location: university?.city || university?.location || "Pakistan",
    email: university?.email || university?.profile?.email || "",
    phone: university?.profile?.phone || "",
    address: university?.profile?.address || "",
    logo: university?.logo || university?.profile?.logo || "",
    representativeName: university?.representativeName || university?.profile?.representativeName || "",
    representativeProfilePicture:
      university?.representativeProfilePicture ||
      university?.profile?.representativeProfilePicture ||
      "",
    programs: rawPrograms
      .map((program) => (typeof program === "string" ? program : program?.name || ""))
      .filter(Boolean),
    programDetails,
    feeRange:
      programDetails.find((program) => program.feeRange)?.feeRange ||
      "Contact university",
    requiredAggregate:
      Number(programDetails.find((program) => program.requiredAggregate)?.requiredAggregate || 0),
    deadline: university?.applicationEndDate
      ? new Date(university.applicationEndDate).toLocaleDateString()
      : "Not announced",
    type: String(university?.type || "public"),
    applicationFee: Number(university?.applicationFee || 0),
  };
};

const normalizeFields = (fields = []) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return defaultApplicationFields;
  }
  return fields;
};

const normalizeTemplateMapping = (mapping, index) => ({
  id: String(mapping?.id || index + 1),
  fieldId: String(mapping?.fieldId || "").trim(),
  label: String(mapping?.label || "").trim(),
  x: Number(mapping?.x || 0),
  y: Number(mapping?.y || 0),
  width: Number(mapping?.width || 200),
  height: Number(mapping?.height || 24),
  fontSize: Number(mapping?.fontSize || 12),
  textAlign: ["left", "center", "right"].includes(String(mapping?.textAlign || "").toLowerCase())
    ? String(mapping.textAlign).toLowerCase()
    : "left",
  color: String(mapping?.color || "#0f172a"),
  page: Math.max(1, Number(mapping?.page || 1)),
});

const normalizeFormTemplate = (template = null) => {
  if (!template || typeof template !== "object") {
    return null;
  }

  const fileUrl = String(template?.fileUrl || "").trim();
  if (!fileUrl) {
    return null;
  }

  return {
    id: String(template?.id || ""),
    name: String(template?.name || "Application Template"),
    renderMode: String(template?.renderMode || "").trim(),
    fileUrl,
    fileName: String(template?.fileName || "").trim(),
    mimeType: String(template?.mimeType || "image/jpeg").trim(),
    pageWidth: Math.max(200, Number(template?.pageWidth || 1240)),
    pageHeight: Math.max(200, Number(template?.pageHeight || 1754)),
    fieldMappings: Array.isArray(template?.fieldMappings)
      ? template.fieldMappings.map(normalizeTemplateMapping).filter((mapping) => mapping.fieldId)
      : [],
  };
};

export const fetchStudentApplicationFormContext = createAsyncThunk(
  "studentApplicationForm/fetchStudentApplicationFormContext",
  async ({ universityId, draftId = "" } = {}, { rejectWithValue }) => {
    try {
      if (!universityId) {
        throw new Error("University id is required.");
      }

      const requests = [
        api.get(`/universities/${universityId}`),
        api.get(`/universities/${universityId}/form`),
        api.get("/students/me/profile"),
      ];

      if (draftId) {
        requests.push(api.get(`/applications/${draftId}`));
      }

      const [universityResponse, formResponse, profileResponse, draftResponse] =
        await Promise.all(requests);

      const university = normalizeUniversity(universityResponse?.data?.university || {});
      const fields = normalizeFields(formResponse?.data?.fields || []);
      const activeTemplate = normalizeFormTemplate(
        formResponse?.data?.activeTemplate || formResponse?.data?.templates?.[0] || null,
      );
      const profile = profileResponse?.data?.profile || {};
      const draftApplication = draftResponse?.data?.application || null;

      if (draftApplication) {
        const draftUniversityId = String(
          draftApplication?.university?._id ||
            draftApplication?.university?.id ||
            draftApplication?.university ||
            "",
        );
        if (draftUniversityId && draftUniversityId !== String(universityId)) {
          throw new Error("Selected draft does not belong to this university.");
        }
      }

      return {
        contextKey: `${String(universityId)}:${String(draftId || "")}`,
        university,
        fields,
        activeTemplate,
        profile,
        draftApplication,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load form details.");
    }
  },
);

export const submitStudentApplicationDraft = createAsyncThunk(
  "studentApplicationForm/submitStudentApplicationDraft",
  async ({ draftId = "", payload = {} } = {}, { rejectWithValue }) => {
    try {
      const response = draftId
        ? await api.patch(`/applications/${draftId}`, payload)
        : await api.post("/applications", payload);

      const application = response?.data?.application || null;
      const applicationId = String(application?._id || application?.id || draftId || "");
      if (!applicationId) {
        throw new Error("Application draft could not be prepared for payment.");
      }

      return {
        applicationId,
        application,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save application draft.");
    }
  },
);

const studentApplicationFormSlice = createSlice({
  name: "studentApplicationForm",
  initialState: {
    contextKey: "",
    university: null,
    formFields: defaultApplicationFields,
    activeTemplate: null,
    studentProfile: null,
    draftApplication: null,
    loading: false,
    error: "",
    submitting: false,
    submitError: "",
    submittedApplicationId: "",
  },
  reducers: {
    clearStudentApplicationFormErrors(state) {
      state.error = "";
      state.submitError = "";
    },
    clearSubmittedApplicationId(state) {
      state.submittedApplicationId = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentApplicationFormContext.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchStudentApplicationFormContext.fulfilled, (state, action) => {
        state.loading = false;
        state.contextKey = action.payload.contextKey;
        state.university = action.payload.university;
        state.formFields = action.payload.fields;
        state.activeTemplate = action.payload.activeTemplate;
        state.studentProfile = action.payload.profile;
        state.draftApplication = action.payload.draftApplication;
      })
      .addCase(fetchStudentApplicationFormContext.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load form details.";
      })
      .addCase(submitStudentApplicationDraft.pending, (state) => {
        state.submitting = true;
        state.submitError = "";
        state.submittedApplicationId = "";
      })
      .addCase(submitStudentApplicationDraft.fulfilled, (state, action) => {
        state.submitting = false;
        state.submittedApplicationId = action.payload.applicationId;
        state.draftApplication = action.payload.application || state.draftApplication;
      })
      .addCase(submitStudentApplicationDraft.rejected, (state, action) => {
        state.submitting = false;
        state.submitError = action.payload || "Unable to save application draft.";
      });
  },
});

export const { clearStudentApplicationFormErrors, clearSubmittedApplicationId } =
  studentApplicationFormSlice.actions;
export default studentApplicationFormSlice.reducer;
