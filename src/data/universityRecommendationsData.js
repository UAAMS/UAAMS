import { api } from "../lib/apiClient";

const defaultApplicationFields = [
  {
    id: "1",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name",
  },
  {
    id: "2",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "your.email@example.com",
  },
  {
    id: "3",
    label: "Phone Number",
    type: "tel",
    required: true,
    placeholder: "+92-300-1234567",
  },
  {
    id: "4",
    label: "CNIC/B-Form Number",
    type: "text",
    required: true,
    placeholder: "12345-1234567-1",
  },
  {
    id: "7",
    label: "Matric Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
  },
  {
    id: "8",
    label: "FSc/A-Level Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
  },
  {
    id: "9",
    label: "Profile Picture",
    type: "file",
    required: true,
    placeholder: "",
  },
  {
    id: "10",
    label: "Domicile Certificate",
    type: "file",
    required: true,
    placeholder: "",
  },
  {
    id: "11",
    label: "Matric Result",
    type: "file",
    required: true,
    placeholder: "",
  },
  {
    id: "12",
    label: "Inter Result",
    type: "file",
    required: true,
    placeholder: "",
  },
];

const normalizeUniversity = (item) => {
  const rawPrograms = Array.isArray(item?.programs) ? item.programs : [];
  const programDetailsFromPrograms = rawPrograms
    .filter((program) => typeof program === "object" && program !== null)
    .map((program) => ({
      name: String(program?.name || "").trim(),
      requiredAggregate: Number(program?.requiredAggregate || 0),
      minimumFscPercentage: Number(item?.minimumFscPercentage || program?.minimumFscPercentage || 0),
      minimumMatricPercentage: Number(item?.minimumMatricPercentage || program?.minimumMatricPercentage || 0),
      seats: Number(program?.seats || 0),
      feeRange: String(program?.feeRange || "").trim(),
      deadlineDate: program?.deadlineDate || null,
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    }))
    .filter((program) => program.name);

  const providedProgramDetails = Array.isArray(item?.programDetails)
    ? item.programDetails
        .map((program) => ({
          name: String(program?.name || "").trim(),
          requiredAggregate: Number(program?.requiredAggregate || 0),
          minimumFscPercentage: Number(item?.minimumFscPercentage || program?.minimumFscPercentage || 0),
          minimumMatricPercentage: Number(item?.minimumMatricPercentage || program?.minimumMatricPercentage || 0),
          seats: Number(program?.seats || 0),
          feeRange: String(program?.feeRange || "").trim(),
          deadlineDate: program?.deadlineDate || null,
          isAdmissionOpen: program?.isAdmissionOpen !== false,
        }))
        .filter((program) => program.name)
    : [];

  const programDetails =
    providedProgramDetails.length > 0 ? providedProgramDetails : programDetailsFromPrograms;

  return {
    id: String(item?.id || item?._id || ""),
    name: item?.name || "University",
    location: item?.location || item?.city || "Pakistan",
    programs: rawPrograms.length
      ? rawPrograms.map((program) =>
          typeof program === "string" ? program : program?.name || "",
        )
      : [],
    programDetails,
    programRecommendations: Array.isArray(item?.programRecommendations)
      ? item.programRecommendations.map((program) => ({
          name: String(program?.name || "").trim(),
          requiredAggregate: Number(program?.requiredAggregate || 0),
          minimumFscPercentage: Number(item?.minimumFscPercentage || program?.minimumFscPercentage || 0),
          minimumMatricPercentage: Number(item?.minimumMatricPercentage || program?.minimumMatricPercentage || 0),
          matchScore: Number(program?.matchScore || 0),
          seats: Number(program?.seats || 0),
          feeRange: String(program?.feeRange || "").trim(),
          deadlineDate: program?.deadlineDate || null,
          deadline: program?.deadline || "Not announced",
          isAdmissionOpen: program?.isAdmissionOpen !== false,
        }))
      : [],
    feeRange: item?.feeRange || "Contact university",
    requiredAggregate: Number(item?.requiredAggregate || 0),
    minimumFscPercentage: Number(item?.minimumFscPercentage || 0),
    minimumMatricPercentage: Number(item?.minimumMatricPercentage || 0),
    deadline: item?.deadline || "Not announced",
    matchScore: Number(item?.matchScore || 0),
    type: String(item?.type || "public"),
    applicationFee: Number(item?.applicationFee || 0),
  };
};

const getRecommendedUniversities = async () => {
  const response = await api.get("/students/recommendations");
  const items = response?.data?.recommendations || [];
  return items.map(normalizeUniversity);
};

const getUniversityById = async (universityId) => {
  if (!universityId) return null;

  try {
    const response = await api.get(`/universities/${universityId}`);
    const university = response?.data?.university;
    if (!university) return null;
    return normalizeUniversity({
      id: university.id,
      name: university.name,
      location: university.city,
      programs: university.programs || [],
      type: university.type,
      applicationFee: university.applicationFee,
      deadline: university.applicationEndDate
        ? new Date(university.applicationEndDate).toLocaleDateString()
        : "Not announced",
    });
  } catch {
    return null;
  }
};

const getApplicationFieldsForUniversity = async (universityId) => {
  if (!universityId) return defaultApplicationFields;

  try {
    const response = await api.get(`/universities/${universityId}/form`);
    const fields = response?.data?.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
      return defaultApplicationFields;
    }
    return fields;
  } catch {
    return defaultApplicationFields;
  }
};

export {
  defaultApplicationFields,
  getRecommendedUniversities,
  getUniversityById,
  getApplicationFieldsForUniversity,
};
