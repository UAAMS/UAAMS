import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const defaultFields = [
  {
    id: "1",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name",
    options: [],
  },
  {
    id: "2",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "your.email@example.com",
    options: [],
  },
  {
    id: "3",
    label: "Phone Number",
    type: "tel",
    required: true,
    placeholder: "+92-300-1234567",
    options: [],
  },
  {
    id: "4",
    label: "CNIC / B-Form",
    type: "text",
    required: true,
    placeholder: "12345-1234567-1",
    options: [],
  },
  {
    id: "7",
    label: "Matric Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
  },
  {
    id: "8",
    label: "FSc/A-Level Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
  },
];

const getDefaultFields = () =>
  defaultFields.map((field) => ({
    ...field,
    options: Array.isArray(field.options) ? [...field.options] : [],
  }));

const normalizeField = (field, index) => ({
  id: String(field?.id || field?._id || index + 1),
  label: String(field?.label || "").trim(),
  type: String(field?.type || "text"),
  required: Boolean(field?.required),
  placeholder: String(field?.placeholder || ""),
  options: Array.isArray(field?.options) ? field.options.map(String) : [],
});

const normalizeProgram = (program, index) => ({
  id: String(program?._id || program?.id || index + 1),
  name: String(program?.name || "").trim(),
  seats: Number(program?.seats || 0),
  feeRange: String(program?.feeRange || "").trim(),
  requiredAggregate: Number(program?.requiredAggregate || 0),
  deadlineDate: program?.deadlineDate
    ? new Date(program.deadlineDate).toISOString().slice(0, 10)
    : "",
  isAdmissionOpen: program?.isAdmissionOpen !== false,
});

const sanitizeFields = (fields = []) =>
  fields
    .map((field, index) => ({
      id: String(field?.id || index + 1),
      label: String(field?.label || "").trim(),
      type: String(field?.type || "text"),
      required: Boolean(field?.required),
      placeholder: String(field?.placeholder || ""),
      options: Array.isArray(field?.options)
        ? field.options.map((option) => String(option).trim()).filter(Boolean)
        : [],
      order: index + 1,
    }))
    .filter((field) => field.label);

const sanitizePrograms = (programs = []) =>
  programs
    .map((program) => ({
      name: String(program?.name || "").trim(),
      seats: Number(program?.seats || 0),
      feeRange: String(program?.feeRange || "").trim(),
      requiredAggregate: Number(program?.requiredAggregate || 0),
      deadlineDate: program?.deadlineDate ? String(program.deadlineDate) : null,
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    }))
    .filter((program) => program.name);

export const fetchUniversityFormSetup = createAsyncThunk(
  "universityFormSetup/fetchUniversityFormSetup",
  async (_, { rejectWithValue }) => {
    try {
      const [formRes, programsRes, settingsRes] = await Promise.all([
        api.get("/universities/me/form"),
        api.get("/universities/me/programs"),
        api.get("/universities/me/settings"),
      ]);

      const fields = Array.isArray(formRes?.data?.fields)
        ? formRes.data.fields.map(normalizeField).filter((field) => field.label)
        : [];
      const programs = Array.isArray(programsRes?.data?.programs)
        ? programsRes.data.programs.map(normalizeProgram).filter((program) => program.name)
        : [];
      const applicationFee = String(Number(settingsRes?.data?.profile?.applicationFee || 0));
      const minimumFscPercentage = String(
        Number(settingsRes?.data?.profile?.minimumFscPercentage || 0),
      );
      const minimumMatricPercentage = String(
        Number(settingsRes?.data?.profile?.minimumMatricPercentage || 0),
      );

      return {
        fields: fields.length > 0 ? fields : getDefaultFields(),
        programs,
        applicationFee,
        minimumFscPercentage,
        minimumMatricPercentage,
        savedAt: formRes?.data?.updatedAt || "",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load form configuration.");
    }
  },
);

export const saveUniversityFormSetup = createAsyncThunk(
  "universityFormSetup/saveUniversityFormSetup",
  async (
    {
      fields = [],
      programs = [],
      applicationFee = "0",
      minimumFscPercentage = "0",
      minimumMatricPercentage = "0",
    } = {},
    { rejectWithValue },
  ) => {
    try {
      const sanitizedFields = sanitizeFields(fields);
      if (sanitizedFields.length === 0) {
        throw new Error("At least one form field is required.");
      }

      const sanitizedPrograms = sanitizePrograms(programs);
      const numericFee = Number(applicationFee || 0);
      const numericMinimumFscPercentage = Number(minimumFscPercentage || 0);
      const numericMinimumMatricPercentage = Number(minimumMatricPercentage || 0);

      const [formRes, programsRes, settingsRes] = await Promise.all([
        api.put("/universities/me/form", { fields: sanitizedFields }),
        api.put("/universities/me/programs", { programs: sanitizedPrograms }),
        api.put("/universities/me/settings", {
          applicationFee: numericFee,
          minimumFscPercentage: numericMinimumFscPercentage,
          minimumMatricPercentage: numericMinimumMatricPercentage,
        }),
      ]);

      const nextFields = Array.isArray(formRes?.data?.form?.fields)
        ? formRes.data.form.fields.map(normalizeField).filter((field) => field.label)
        : sanitizedFields.map(normalizeField).filter((field) => field.label);
      const nextPrograms = Array.isArray(programsRes?.data?.programs)
        ? programsRes.data.programs.map(normalizeProgram).filter((program) => program.name)
        : sanitizedPrograms.map(normalizeProgram).filter((program) => program.name);

      return {
        fields: nextFields.length > 0 ? nextFields : getDefaultFields(),
        programs: nextPrograms,
        applicationFee: String(Number(settingsRes?.data?.profile?.applicationFee ?? numericFee)),
        minimumFscPercentage: String(
          Number(
            settingsRes?.data?.profile?.minimumFscPercentage ?? numericMinimumFscPercentage,
          ),
        ),
        minimumMatricPercentage: String(
          Number(
            settingsRes?.data?.profile?.minimumMatricPercentage ??
              numericMinimumMatricPercentage,
          ),
        ),
        savedAt: formRes?.data?.form?.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save form configuration.");
    }
  },
);

export const saveUniversityFormFields = createAsyncThunk(
  "universityFormSetup/saveUniversityFormFields",
  async (fields = [], { rejectWithValue }) => {
    try {
      const sanitizedFields = sanitizeFields(fields);
      if (sanitizedFields.length === 0) {
        throw new Error("At least one form field is required.");
      }

      const response = await api.put("/universities/me/form", { fields: sanitizedFields });
      const nextFields = Array.isArray(response?.data?.form?.fields)
        ? response.data.form.fields.map(normalizeField).filter((field) => field.label)
        : sanitizedFields.map(normalizeField).filter((field) => field.label);

      return {
        fields: nextFields.length > 0 ? nextFields : getDefaultFields(),
        savedAt: response?.data?.form?.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save form configuration.");
    }
  },
);

const universityFormSetupSlice = createSlice({
  name: "universityFormSetup",
  initialState: {
    fields: getDefaultFields(),
    programs: [],
    applicationFee: "0",
    minimumFscPercentage: "0",
    minimumMatricPercentage: "0",
    savedAt: "",
    loading: false,
    saving: false,
    error: "",
    saveError: "",
    saveSuccessMessage: "",
  },
  reducers: {
    clearUniversityFormSetupMessages(state) {
      state.error = "";
      state.saveError = "";
      state.saveSuccessMessage = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversityFormSetup.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchUniversityFormSetup.fulfilled, (state, action) => {
        state.loading = false;
        state.fields = action.payload.fields;
        state.programs = action.payload.programs;
        state.applicationFee = action.payload.applicationFee;
        state.minimumFscPercentage = action.payload.minimumFscPercentage;
        state.minimumMatricPercentage = action.payload.minimumMatricPercentage;
        state.savedAt = action.payload.savedAt;
      })
      .addCase(fetchUniversityFormSetup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load form configuration.";
      })
      .addCase(saveUniversityFormSetup.pending, (state) => {
        state.saving = true;
        state.saveError = "";
        state.saveSuccessMessage = "";
      })
      .addCase(saveUniversityFormSetup.fulfilled, (state, action) => {
        state.saving = false;
        state.fields = action.payload.fields;
        state.programs = action.payload.programs;
        state.applicationFee = action.payload.applicationFee;
        state.minimumFscPercentage = action.payload.minimumFscPercentage;
        state.minimumMatricPercentage = action.payload.minimumMatricPercentage;
        state.savedAt = action.payload.savedAt;
        state.saveSuccessMessage = "Form fields, programs, application fee, and eligibility criteria saved successfully.";
      })
      .addCase(saveUniversityFormSetup.rejected, (state, action) => {
        state.saving = false;
        state.saveError = action.payload || "Unable to save form configuration.";
      })
      .addCase(saveUniversityFormFields.pending, (state) => {
        state.saving = true;
        state.saveError = "";
        state.saveSuccessMessage = "";
      })
      .addCase(saveUniversityFormFields.fulfilled, (state, action) => {
        state.saving = false;
        state.fields = action.payload.fields;
        state.savedAt = action.payload.savedAt;
        state.saveSuccessMessage = "Application form saved successfully.";
      })
      .addCase(saveUniversityFormFields.rejected, (state, action) => {
        state.saving = false;
        state.saveError = action.payload || "Unable to save form configuration.";
      });
  },
});

export const { clearUniversityFormSetupMessages } = universityFormSetupSlice.actions;
export default universityFormSetupSlice.reducer;
