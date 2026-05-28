import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, School } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import {
  isNumberInRange,
  isSupportedDocumentFile,
  isSupportedProfileImage,
  isValidCnic,
  isValidEmail,
  isValidName,
  isValidPhone,
} from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearStudentApplicationFormErrors,
  fetchStudentApplicationFormContext,
  submitStudentApplicationDraft,
} from "../../store/slices/studentApplicationFormSlice";

const getFieldValue = ({
  field,
  value,
  onChange,
  onFileChange,
  error,
  fileHint,
  fileHelperText,
  accept,
  onClearFile,
}) => {
  const commonClass = `w-full px-3 py-2 border rounded-lg text-sm ${
    error ? "border-red-500" : "border-slate-300"
  }`;

  if (field.type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(event) => onChange(field.id, event.target.value)}
        placeholder={field.placeholder}
        className={commonClass}
        rows={4}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={value || ""}
        onChange={(event) => onChange(field.id, event.target.value)}
        className={commonClass}
      >
        <option value="">Select an option</option>
        {field.options?.map((option, index) => (
          <option key={`${field.id}-${index}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "file") {
    return (
      <div className="space-y-2">
        {value ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span className="min-w-0 truncate">Attached: {fileHint || "Document uploaded"}</span>
            <button
              type="button"
              onClick={() => onClearFile(field.id)}
              className="rounded border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-100"
            >
              Remove
            </button>
          </div>
        ) : null}
        <input
          type="file"
          accept={accept}
          onChange={(event) => onFileChange(field.id, event.target.files?.[0])}
          className={commonClass}
        />
        {fileHelperText ? <p className="text-xs text-slate-500">{fileHelperText}</p> : null}
      </div>
    );
  }

  return (
    <input
      type={field.type}
      value={value || ""}
      onChange={(event) => onChange(field.id, event.target.value)}
      placeholder={field.placeholder}
      className={commonClass}
    />
  );
};

const hasTextValue = (value) => String(value ?? "").trim().length > 0;

const getFileRulesForField = (field) => {
  const label = String(field?.label || "").toLowerCase();
  if ((label.includes("profile") && label.includes("picture")) || label.includes("photo")) {
    return {
      accept: ".jpg,.jpeg,.png",
      helperText: "JPG or PNG only.",
      isValid: isSupportedProfileImage,
    };
  }

  return {
    accept: ".pdf,.jpg,.jpeg,.png",
    helperText: "PDF, JPG, or PNG only.",
    isValid: isSupportedDocumentFile,
  };
};

const validateFieldValue = (field, value) => {
  const label = String(field?.label || "This field").trim();
  const lowerLabel = label.toLowerCase();
  const textValue = String(value || "").trim();

  if (field.required && !textValue) {
    return `${label} is required.`;
  }

  if (!textValue || field.type === "file") {
    return "";
  }

  if (lowerLabel.includes("email") && !isValidEmail(textValue)) {
    return "Enter a valid email address.";
  }

  if ((lowerLabel.includes("phone") || lowerLabel.includes("mobile")) && !isValidPhone(textValue)) {
    return "Enter a valid Pakistani mobile number.";
  }

  if ((lowerLabel.includes("cnic") || lowerLabel.includes("b-form")) && !isValidCnic(textValue)) {
    return "Enter a valid CNIC or B-form number.";
  }

  if (
    (lowerLabel.includes("name") || lowerLabel.includes("father")) &&
    !lowerLabel.includes("university") &&
    !isValidName(textValue)
  ) {
    return "Use letters, spaces, apostrophes, periods, or hyphens.";
  }

  if (field.type === "number" || lowerLabel.includes("marks") || lowerLabel.includes("aggregate")) {
    const maxValue = lowerLabel.includes("aggregate") || lowerLabel.includes("percentage") ? 100 : 1100;
    if (!isNumberInRange(textValue, 0, maxValue)) {
      return `${label} must be a number between 0 and ${maxValue}.`;
    }
  }

  return "";
};

const pickFirstValue = (...values) => {
  for (const value of values) {
    if (hasTextValue(value)) {
      return String(value);
    }
  }
  return "";
};

const splitFullName = (fullName = "") => {
  const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "",
  };
};

const resolveProfileValueForField = ({ field, profile, currentUser }) => {
  const byFieldId = {
    "1": pickFirstValue(profile?.fullName, currentUser?.name),
    "2": pickFirstValue(profile?.email, currentUser?.email),
    "3": pickFirstValue(profile?.phone),
    "4": pickFirstValue(profile?.cnic),
    "7": pickFirstValue(profile?.matricObtainedMarks),
    "8": pickFirstValue(profile?.interObtainedMarks),
    "9": pickFirstValue(profile?.profilePicture),
    "10": pickFirstValue(profile?.domicileDocument),
    "11": pickFirstValue(profile?.matricResultDocument),
    "12": pickFirstValue(profile?.interResultDocument),
  };

  if (Object.prototype.hasOwnProperty.call(byFieldId, field.id)) {
    return byFieldId[field.id];
  }

  const label = String(field?.label || "").toLowerCase();

  if (label.includes("full name")) return pickFirstValue(profile?.fullName, currentUser?.name);
  if (label.includes("email")) return pickFirstValue(profile?.email, currentUser?.email);
  if (label.includes("father")) return pickFirstValue(profile?.fatherName);
  if (label.includes("cnic") || label.includes("b-form")) return pickFirstValue(profile?.cnic);
  if (label.includes("phone")) return pickFirstValue(profile?.phone);
  if (label.includes("date of birth") || label.includes("dob")) return pickFirstValue(profile?.dateOfBirth);
  if (label.includes("address")) return pickFirstValue(profile?.address);
  if (label === "city" || label.includes("city")) return pickFirstValue(profile?.city);
  if (label.includes("province")) return pickFirstValue(profile?.province);
  if (label.includes("postal")) return pickFirstValue(profile?.postalCode);
  if ((label.includes("profile") && label.includes("picture")) || label.includes("photo")) {
    return pickFirstValue(profile?.profilePicture);
  }
  if (label.includes("domicile")) return pickFirstValue(profile?.domicileDocument);
  if (label.includes("matric") && label.includes("result")) {
    return pickFirstValue(profile?.matricResultDocument);
  }
  if ((label.includes("inter") || label.includes("fsc") || label.includes("a-level")) && label.includes("result")) {
    return pickFirstValue(profile?.interResultDocument);
  }
  if (label.includes("matric") && label.includes("marks")) {
    return pickFirstValue(profile?.matricObtainedMarks);
  }
  if ((label.includes("inter") || label.includes("fsc") || label.includes("a-level")) && label.includes("marks")) {
    return pickFirstValue(profile?.interObtainedMarks);
  }

  return "";
};

const resolveProfileFileNameForField = ({ field, profile }) => {
  const byFieldId = {
    "9": pickFirstValue(profile?.profilePictureFileName, "Profile Picture"),
    "10": pickFirstValue(profile?.domicileFileName, "Domicile Certificate"),
    "11": pickFirstValue(profile?.matricResultFileName, "Matric Result"),
    "12": pickFirstValue(profile?.interResultFileName, "Inter Result"),
  };

  if (Object.prototype.hasOwnProperty.call(byFieldId, field.id)) {
    return byFieldId[field.id];
  }

  const label = String(field?.label || "").toLowerCase();
  if ((label.includes("profile") && label.includes("picture")) || label.includes("photo")) {
    return pickFirstValue(profile?.profilePictureFileName, "Profile Picture");
  }
  if (label.includes("domicile")) {
    return pickFirstValue(profile?.domicileFileName, "Domicile Certificate");
  }
  if (label.includes("matric") && label.includes("result")) {
    return pickFirstValue(profile?.matricResultFileName, "Matric Result");
  }
  if ((label.includes("inter") || label.includes("fsc") || label.includes("a-level")) && label.includes("result")) {
    return pickFirstValue(profile?.interResultFileName, "Inter Result");
  }
  return "";
};

const buildAutoFilledFormData = ({ fields, profile, currentUser }) => {
  const autoFill = {};
  const autoFillFileHints = {};

  fields.forEach((field) => {
    const value = resolveProfileValueForField({ field, profile, currentUser });
    if (hasTextValue(value)) {
      autoFill[field.id] = String(value);
      if (field.type === "file") {
        const fileName = resolveProfileFileNameForField({ field, profile });
        autoFillFileHints[field.id] = fileName || "Document from profile";
      }
    }
  });

  return {
    values: autoFill,
    fileHints: autoFillFileHints,
  };
};

const requiredDocumentFields = [
  {
    id: "uaams-doc-profile-picture",
    label: "Profile Picture",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    keywords: ["profile", "picture"],
  },
  {
    id: "uaams-doc-domicile",
    label: "Domicile Certificate",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    keywords: ["domicile"],
  },
  {
    id: "uaams-doc-matric-result",
    label: "Matric Result",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    keywords: ["matric", "result"],
  },
  {
    id: "uaams-doc-inter-result",
    label: "Inter Result",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    keywords: ["inter", "result"],
  },
];

const ensureRequiredDocumentFields = (fields = []) => {
  const next = [...fields];

  requiredDocumentFields.forEach((requiredField) => {
    const alreadyExists = next.some((field) => {
      const label = String(field?.label || "").toLowerCase();
      return requiredField.keywords.every((keyword) => label.includes(keyword));
    });

    if (!alreadyExists) {
      const { keywords, ...fieldWithoutKeywords } = requiredField;
      next.push(fieldWithoutKeywords);
    }
  });

  return next;
};

const hasDeadlinePassed = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const formatPreviewDate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalizePreviewValue = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/uploads/") || /^https?:\/\//i.test(text)) {
    const cleanUrl = text.split("#")[0].split("?")[0];
    const fileName = cleanUrl.split("/").filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : text;
  }
  if (/^data:[^;]+;base64,/i.test(text)) {
    return "[file]";
  }
  return text;
};

const resolveTemplateFieldValue = ({
  template,
  formFields,
  fieldId,
  formData,
  university,
  resolvedProgram,
  currentUser,
  studentProfile,
}) => {
  const mappedFieldIds = new Set(
    Array.isArray(template?.fieldMappings)
      ? template.fieldMappings
          .map((mapping) => String(mapping?.fieldId || "").trim())
          .filter(Boolean)
      : [],
  );
  const fieldLabelLookup = (Array.isArray(formFields) ? formFields : []).reduce((acc, field) => {
    const id = String(field?.id || "").trim();
    const label = String(field?.label || "").trim();
    if (id && label) {
      acc[id] = label;
    }
    return acc;
  }, {});
  const fullName = pickFirstValue(formData?.["1"], studentProfile?.fullName, currentUser?.name);
  const splitName = splitFullName(fullName);
  const normalizedGender = String(formData?.gender || studentProfile?.gender || "")
    .trim()
    .toLowerCase();
  const matricMarks = Number(formData?.["7"] || 0);
  const interMarks = Number(formData?.["8"] || 0);
  const calculatedAggregate =
    Number(formData?.aggregate || 0) ||
    (matricMarks > 0 && interMarks > 0
      ? Number((((matricMarks + interMarks) / 2200) * 100).toFixed(2))
      : 0);
  const consumedFieldIds = new Set([
    "1",
    "2",
    "3",
    "4",
    "dob",
    "gender",
    "nationality",
    "city",
    "province",
    "postalCode",
    "address",
  ]);
  const dynamicFieldsSummary = Object.entries(formData || {})
    .map(([id, value]) => ({
      id: String(id || "").trim(),
      value: normalizePreviewValue(value),
    }))
    .filter(
      (entry) =>
        entry.id &&
        entry.value &&
        !mappedFieldIds.has(entry.id) &&
        !consumedFieldIds.has(entry.id),
    )
    .map((entry) => `${fieldLabelLookup[entry.id] || `Field ${entry.id}`}: ${entry.value}`)
    .join(" | ");

  const metaLookup = {
    "meta.universityContactSummary": [university?.name, university?.email, university?.phone, university?.address]
      .filter(hasTextValue)
      .join("\n"),
    "meta.universityName": university?.name || "",
    "meta.universityEmail": university?.email || "",
    "meta.universityPhone": university?.phone || "",
    "meta.universityAddress": university?.address || "",
    "meta.universityCity": university?.location || "",
    "meta.applicationCode": "Generated after payment",
    "meta.program": resolvedProgram || "",
    "meta.applicationStatus": "Draft",
    "meta.aggregate": calculatedAggregate > 0 ? `${calculatedAggregate}%` : "",
    "meta.appliedDate": formatPreviewDate(new Date()),
    "meta.studentName": fullName,
    "meta.studentEmail": formData?.["2"] || studentProfile?.email || currentUser?.email || "",
    "meta.studentCnic": formData?.["4"] || studentProfile?.cnic || "",
    "meta.studentFirstName": splitName.firstName,
    "meta.studentLastName": splitName.lastName || splitName.firstName,
    "meta.studentBirthDate": formData?.dob || studentProfile?.dateOfBirth || "",
    "meta.studentGender": formData?.gender || studentProfile?.gender || "",
    "meta.genderMaleMark": ["m", "male", "man"].includes(normalizedGender) ? "X" : "",
    "meta.genderFemaleMark": ["f", "female", "woman"].includes(normalizedGender) ? "X" : "",
    "meta.studentNationality": formData?.nationality || studentProfile?.nationality || "",
    "meta.studentPhone":
      formData?.["3"] || studentProfile?.phone || studentProfile?.alternatePhone || "",
    "meta.studentCity": formData?.city || studentProfile?.city || "",
    "meta.studentProvince": formData?.province || studentProfile?.province || "",
    "meta.studentPostalCode": formData?.postalCode || studentProfile?.postalCode || "",
    "meta.studentAddressLine": formData?.address || studentProfile?.address || "",
    "meta.studentSignature": fullName,
    "meta.dynamicFieldsSummary": dynamicFieldsSummary,
  };

  if (Object.prototype.hasOwnProperty.call(metaLookup, fieldId)) {
    return normalizePreviewValue(metaLookup[fieldId]);
  }

  return normalizePreviewValue(formData?.[fieldId] || "");
};

export const StudentApplicationFormPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { universityId } = useParams();
  const [searchParams] = useSearchParams();
  const selectedProgram = searchParams.get("program") || "";
  const draftId = searchParams.get("draft") || "";
  const {
    university,
    formFields: storedFormFields,
    activeTemplate,
    studentProfile,
    draftApplication,
    loading: isLoading,
    error,
    submitting: isSubmitting,
    submitError: submissionError,
  } = useAppSelector((state) => state.studentApplicationForm);

  const formFields = useMemo(
    () => ensureRequiredDocumentFields(storedFormFields || []),
    [storedFormFields],
  );
  const draftProgram = useMemo(() => String(draftApplication?.program || ""), [draftApplication?.program]);

  const [formData, setFormData] = useState({
    "1": currentUser?.name || "",
    "2": currentUser?.email || "",
  });
  const [errors, setErrors] = useState({});
  const [localSubmitError, setLocalSubmitError] = useState("");
  const [autoFillMessage, setAutoFillMessage] = useState("");
  const [fileHints, setFileHints] = useState({});
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  useEffect(() => {
    dispatch(clearStudentApplicationFormErrors());
    dispatch(fetchStudentApplicationFormContext({ universityId, draftId }));
    return () => {
      dispatch(clearStudentApplicationFormErrors());
    };
  }, [dispatch, universityId, draftId]);

  useEffect(() => {
    const autoFillData = buildAutoFilledFormData({
      fields: formFields,
      profile: studentProfile || {},
      currentUser,
    });

    const nextFormData = {
      "1": currentUser?.name || "",
      "2": currentUser?.email || "",
      ...autoFillData.values,
      ...(draftApplication?.formData || {}),
    };

    const nextFileHints = { ...autoFillData.fileHints };
    formFields.forEach((field) => {
      if (field.type !== "file") return;
      const value = draftApplication?.formData?.[field.id];
      if (String(value || "").trim()) {
        nextFileHints[field.id] = field.label || "Attached document";
      }
    });

    setFormData(nextFormData);
    setFileHints(nextFileHints);
    setErrors({});
    setLocalSubmitError("");
    setAutoFillMessage(
      Object.keys(autoFillData.values).length > 0
        ? "Form was auto-filled from your student profile. You can edit any field before submission."
        : "",
    );
  }, [formFields, studentProfile, currentUser, draftApplication]);

  const resolvedProgram = useMemo(
    () => selectedProgram || draftProgram || university?.programs?.[0] || "Program",
    [selectedProgram, draftProgram, university],
  );
  const selectedProgramDetails = useMemo(() => {
    const details = Array.isArray(university?.programDetails) ? university.programDetails : [];
    const normalizedProgram = String(resolvedProgram || "").trim().toLowerCase();
    return (
      details.find(
        (program) =>
          String(program?.name || "").trim().toLowerCase() === normalizedProgram,
      ) || null
    );
  }, [resolvedProgram, university?.programDetails]);
  const programMissingFromUniversity =
    Array.isArray(university?.programDetails) &&
    university.programDetails.length > 0 &&
    !selectedProgramDetails;
  const isProgramAdmissionClosed = selectedProgramDetails?.isAdmissionOpen === false;
  const isProgramDeadlinePassed = hasDeadlinePassed(selectedProgramDetails?.deadlineDate);
  const isSubmissionBlocked =
    programMissingFromUniversity || isProgramAdmissionClosed || isProgramDeadlinePassed;
  const effectiveSubmitError = localSubmitError || submissionError;

  const handleChange = (fieldId, value) => {
    setFormData((previous) => ({ ...previous, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((previous) => ({ ...previous, [fieldId]: "" }));
    }
    if (localSubmitError) {
      setLocalSubmitError("");
    }
    if (submissionError) {
      dispatch(clearStudentApplicationFormErrors());
    }
  };

  const handleFileChange = async (fieldId, file) => {
    if (!file) return;

    const field = formFields.find((item) => String(item.id) === String(fieldId));
    const fileRules = getFileRulesForField(field);
    if (!fileRules.isValid(file)) {
      setErrors((previous) => ({
        ...previous,
        [fieldId]: `${field?.label || "File"} must be ${fileRules.helperText.toLowerCase()}`,
      }));
      setFileHints((previous) => ({ ...previous, [fieldId]: "" }));
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({ ...previous, [fieldId]: dataUrl }));
      setFileHints((previous) => ({ ...previous, [fieldId]: file.name }));
      if (errors[fieldId]) {
        setErrors((previous) => ({ ...previous, [fieldId]: "" }));
      }
      if (submissionError) {
        dispatch(clearStudentApplicationFormErrors());
      }
    } catch (fileError) {
      setLocalSubmitError(fileError?.message || "Unable to read selected file.");
    }
  };

  const handleClearFile = (fieldId) => {
    setFormData((previous) => ({ ...previous, [fieldId]: "" }));
    setFileHints((previous) => ({ ...previous, [fieldId]: "" }));
    if (submissionError) {
      dispatch(clearStudentApplicationFormErrors());
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalSubmitError("");
    dispatch(clearStudentApplicationFormErrors());

    if (programMissingFromUniversity) {
      setLocalSubmitError("Selected program is no longer available. Please choose another program.");
      return;
    }

    if (isProgramAdmissionClosed) {
      setLocalSubmitError("Admission is currently closed for this program.");
      return;
    }

    if (isProgramDeadlinePassed) {
      setLocalSubmitError("Application deadline has passed for this program.");
      return;
    }

    const nextErrors = {};

    formFields.forEach((field) => {
      const fieldError = validateFieldValue(field, formData[field.id]);
      if (fieldError) {
        nextErrors[field.id] = fieldError;
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const payload = {
        universityId: university?.id || universityId,
        program: resolvedProgram,
        formData,
      };

      const { applicationId = "" } = await dispatch(
        submitStudentApplicationDraft({ draftId, payload }),
      ).unwrap();

      if (!applicationId) {
        setLocalSubmitError("Application draft could not be prepared for payment.");
        return;
      }

      navigate(`/student/apply/${universityId}/payment/${applicationId}`);
    } catch (submissionFailure) {
      setLocalSubmitError(
        typeof submissionFailure === "string"
          ? submissionFailure
          : submissionFailure?.message || "Unable to save application draft.",
      );
    }
  };

  if (isLoading) {
    return (
      <DashboardPageShell
        title="Application Form"
        subtitle="Loading university form..."
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Fetching form details...
        </div>
      </DashboardPageShell>
    );
  }

  if (error || !university) {
    return (
      <DashboardPageShell
        title="Application Form"
        subtitle={error || "Selected university could not be found."}
        actions={
          <button
            onClick={() => navigate("/student/recommendations")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to Recommendations
          </button>
        }
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Please return to recommendations and choose a valid university/program.
        </div>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell
      title="Application Form"
      subtitle={`${university.name} - ${resolvedProgram || "Program not selected"}`}
      actions={
        <button
          onClick={() => navigate("/student/recommendations")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      }
    >
      <UniversityApplicationHeader university={university} program={resolvedProgram} />
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {draftId ? (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Editing unpaid draft. You can update details before payment.
          </div>
        ) : null}
        
        {programMissingFromUniversity ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            This program is no longer available. Please go back to recommendations.
          </div>
        ) : null}
        {isProgramAdmissionClosed ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Admission is closed for this program.
          </div>
        ) : null}
        {isProgramDeadlinePassed ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Application deadline has passed for this program.
          </div>
        ) : null}

        {formFields.map((field) => {
          const fileRules = field.type === "file" ? getFileRulesForField(field) : null;
          return (
          <div key={field.id}>
            <label className="mb-2 block text-sm text-slate-700">
              {field.label}
              {field.required ? <span className="ml-1 text-red-500">*</span> : null}
            </label>
            {getFieldValue({
              field,
              value: formData[field.id],
              onChange: handleChange,
              onFileChange: handleFileChange,
              error: errors[field.id],
              fileHint: fileHints[field.id],
              fileHelperText: fileRules?.helperText,
              accept: fileRules?.accept,
              onClearFile: handleClearFile,
            })}
            {errors[field.id] ? (
              <p className="mt-1 text-xs text-red-600">{errors[field.id]}</p>
            ) : null}
          </div>
          );
        })}

        {effectiveSubmitError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{effectiveSubmitError}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/student/recommendations")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isSubmissionBlocked}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
          >
            {isSubmitting
              ? draftId
                ? "Updating Draft..."
                : "Creating Draft..."
              : "Continue to Payment"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
      {showTemplatePreview && activeTemplate ? (
        <ApplicationTemplatePreviewModal
          template={activeTemplate}
          formData={formData}
          university={university}
          resolvedProgram={resolvedProgram}
          currentUser={currentUser}
          studentProfile={studentProfile}
          formFields={formFields}
          onClose={() => setShowTemplatePreview(false)}
        />
      ) : null}
    </DashboardPageShell>
  );
};

function UniversityApplicationHeader({ university, program }) {
  const logoUrl = university?.logo || university?.representativeProfilePicture || "";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-100">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${university?.name || "University"} logo`}
            className="h-full w-full object-cover"
          />
        ) : (
          <School className="h-8 w-8 text-emerald-600" />
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{university?.name || "University"}</h2>
        <p className="text-sm text-slate-600">{program || "Program not selected"}</p>
      </div>
    </section>
  );
}

const ApplicationTemplatePreviewModal = ({
  template,
  formData,
  university,
  resolvedProgram,
  currentUser,
  studentProfile,
  formFields,
  onClose,
}) => {
  const pageWidth = Math.max(200, Number(template?.pageWidth || 1240));
  const pageHeight = Math.max(200, Number(template?.pageHeight || 1754));
  const mappings = Array.isArray(template?.fieldMappings) ? template.fieldMappings : [];

  return (
    <div className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-slate-900">Template Preview</h3>
            <p className="text-xs text-slate-600">
              {template?.name || "Application Template"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(95vh-64px)] overflow-auto bg-slate-100 p-4">
          <div className="mx-auto w-fit rounded-lg border border-slate-200 bg-white p-3">
            <div
              className="relative overflow-hidden rounded border border-slate-200"
              style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
            >
              <img
                src={template.fileUrl}
                alt={template.name || "Template"}
                className="h-full w-full object-fill"
              />
              {mappings.map((mapping) => {
                const fieldId = String(mapping?.fieldId || "").trim();
                if (!fieldId) return null;

                const value = resolveTemplateFieldValue({
                  template,
                  formFields,
                  fieldId,
                  formData,
                  university,
                  resolvedProgram,
                  currentUser,
                  studentProfile,
                });
                if (!value) return null;

                const width = Math.max(20, Number(mapping?.width || 200));
                const height = Math.max(16, Number(mapping?.height || 24));
                const fontSize = Math.max(8, Number(mapping?.fontSize || 12));
                const x = Math.max(0, Number(mapping?.x || 0));
                const y = Math.max(0, Number(mapping?.y || 0));
                const textAlign = ["left", "center", "right"].includes(
                  String(mapping?.textAlign || "").toLowerCase(),
                )
                  ? String(mapping.textAlign).toLowerCase()
                  : "left";

                return (
                  <div
                    key={mapping.id || `${fieldId}-${x}-${y}`}
                    className="absolute whitespace-pre-wrap break-words"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${width}px`,
                      minHeight: `${height}px`,
                      fontSize: `${fontSize}px`,
                      lineHeight: 1.25,
                      color: String(mapping?.color || "#0f172a"),
                      textAlign,
                    }}
                  >
                    {value}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
