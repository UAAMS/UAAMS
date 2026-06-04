/* eslint-disable no-console */
const mongoose = require("mongoose");
const connectDb = require("../config/db");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const UniversityForm = require("../models/UniversityForm");
const Application = require("../models/Application");
const Announcement = require("../models/Announcement");
const BlogPost = require("../models/BlogPost");
const {
  ROLES,
  UNIVERSITY_APPROVAL,
  USER_STATUS,
} = require("../constants/roles");

const defaultFormFields = [
  {
    id: "1",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name",
    options: [],
    order: 1,
  },
  {
    id: "2",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "your.email@example.com",
    options: [],
    order: 2,
  },
  {
    id: "3",
    label: "Phone Number",
    type: "tel",
    required: true,
    placeholder: "+92-300-1234567",
    options: [],
    order: 3,
  },
  {
    id: "4",
    label: "CNIC/B-Form Number",
    type: "text",
    required: true,
    placeholder: "12345-1234567-1",
    options: [],
    order: 4,
  },
  {
    id: "7",
    label: "Matric Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
    order: 7,
  },
  {
    id: "8",
    label: "FSc/A-Level Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
    order: 8,
  },
];

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getInitials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

const makeUniversityLogoDataUrl = (name, color = "#1d4ed8") => {
  const initials = getInitials(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" rx="48" fill="${color}"/>
      <circle cx="128" cy="96" r="48" fill="#ffffff" opacity="0.18"/>
      <path d="M48 177h160v20H48zM68 147h24v30H68zM116 147h24v30h-24zM164 147h24v30h-24zM52 130l76-46 76 46v14H52z" fill="#ffffff" opacity="0.9"/>
      <text x="128" y="226" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg.replace(/\s+/g, " ").trim()).toString("base64")}`;
};

const provinceByCity = {
  Abbottabad: "Khyber Pakhtunkhwa",
  Bahawalpur: "Punjab",
  Faisalabad: "Punjab",
  Islamabad: "Islamabad Capital Territory",
  Karachi: "Sindh",
  Kharian: "Punjab",
  Lahore: "Punjab",
  Multan: "Punjab",
  Quetta: "Balochistan",
  Rawalpindi: "Punjab",
  Wah: "Punjab",
};

const programSeedLines = `
PU_ALLAMAIQBAL_CAMPUS | BS_ARCHITECTURE
UET_LAHORE_CAMPUS|BS_ARCHITECURE_ENGINEEERING
UET_LAHORE_CAMPUS|BS_ARCHITECTURE
UET_LAHORE_CAMPUS|BS_AUTOMOTIVE_ENGINEERING
UET_LAHORE|BACHELOR_OF_BUSINESS_ADMINISTRATION
UET_LAHORE|BACHELOR_OF_BUSINESS_INFORMATION_TECHNOLOGY
UET_LAHORE|BIOMEDICAL_ENGINEERING
UET_LAHORE|CHEMICAL_ENGINEERING
UET_LAHORE|BS_CHEMISTRY
UET_LAHORE|BS_CITY_&_REGIONAL_PLANNIG
UET_LAHORE|BS_CIVIL_ENGINEERING
UET_LAHORE|BS_COMPUTER_SCIENCE
UET_LAHORE|BS_DATA_SCIENCE
UET_LAHORE|BS_ELECTRICAL_ENGINEERING
UET_LAHORE|BS_ENERGY_SYSTEMS_AND_MANAGEMENT
UET_LAHORE|BS_ENVIRONMENTAL_SCIENCE
UET_LAHORE|BS|FOOD_SCIENCE_&_TECHNOLOGY
UET_LAHORE|BS_GEOLOGICAL_ENGINEERING
UET_LAHORE|BS_INDUSTRIAL_&_MANUFACTURING_ENGINEERING
UET_LAHORE|BS_MATHEMATICS
UET_LAHORE|BS_MECHANICAL_ENGINEERING
UET_LAHORE|BS_MECHATRONICS_&_CONTROL_ENGINEERING
UET_LAHORE|BS_METALLURGICAL_&_MATERIALS_ENGINEERING
UET_LAHORE|BS_MINING_ENGINEERING
UET_LAHORE|BS_PETROLEUM_&_GAS_ENGINEERING
UET_LAHORE|BS_PHYSICS
UET_LAHORE|BS_POLYMER_ENGINEERING
UET_LAHORE|BS_PRODUCT_&_INDUSTRIAL_DESIGN
UET_LAHORE|BS_SOFTWARE_ENGINEERING
UET_LAHORE|BS_TEXTILE_ENGINEERING
UET_LAHORE|BS_TRANSPORTATION_ENGINEERING
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_CHEMISTRY
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_HOME_ECONOMICS
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_EASTERN_MEDICINE
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BED
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_ENVIRONMENTAL_SCIENCE
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_FOOD_SCIENCES
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_HISTORY
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_PAKISTAN_STUDIES
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_PHYSIOLOGY
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_PUBLIC_ADMINISTRATION
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_SOFTWARE_ENGINEERING
GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD|BS_ZOOLOGY
NUST_ISLAMABAD|BS_SOFTWARE_ENGINEERING
NUST_ISLAMABAD|BS_ELECTRICAL_ENGINEERING
NUST_ISLAMABAD|BS_CIVIL_ENGINEERING
NUST_ISLAMABAD|BS_MACHENICAL_ENGINEERING
NUST_ISLAMABAD|BS_AEROSPACE_EGINEERING
NUST_ISLAMABAD|BS_INFORMATION_SECURITY_ENGINEERING
NUST_ISLAMABAD|BS_MECHATRONICS_ENGINEERING
NUST_ISLAMABAD|BS_ENVIRONMENTAL_ENGINEERING
NUST_ISLAMABAD|BS_NAVAL_ARCHITECTURE_ENGINEERING
NUST_ISLAMABAD|BS_AVIONICS_ENGINEERING
NUST_ISLAMABAD|BS_COMPUTER_ENGINEERING
NUST_ISLAMABAD|BS_MATERIAL_ENGINEERING
NUST_ISLAMABAD|BACHELOR_OF_BUSINESS_ADMINISTRATION
NUST_ISLAMABAD|BS_ACCOUNTING_AND_FINANCE
NUST_ISLAMABAD|BS_ECONOMICS
NUST_ISLAMABAD|BS_PSYCHOLOGY
NUST_ISLAMABAD|BS_PUBLIC_ADMINISTRATION
NUST_ISLAMABAD|BS_TOURISM_AND_HOSPITALITY
NUST_ISLAMABAD|BS_MASS_COMMUNICATION
NUST_ISLAMABAD|BS_COMPUTER_SCIENCE
NUST_ISLAMABAD|BS_ARTIFICIAL_INTEllIGENCE
NUST_ISLAMABAD|BS_DATA_SCIENCE
NUST_ISLAMABAD|BS_BIOINFORMATIC
FAST_LAHORE|BS_COMPUTER_SCIENCE
FAST_LAHORE|BS_SOFTWARE_ENGINEERING
FAST_LAHORE|BS_ARTIFICIAL_INTEllIGENCE
FAST_LAHORE|BS_DATA_SCIENCE
FAST_LAHORE|BS_CYBER_SECURITY
FAST_LAHORE|BS_ELECTRICAL_ENGINEERING
FAST_LAHORE|BACHELOR_OF_BUSINESS_ADMINISTRATION
FAST_LAHORE|BS_CIVIL_ENGINEERING
FAST_LAHORE|BS_BUSINESS_ANALYTICS
NED_KARACHI|BS_CIVIL_ENGINEERING
NED_KARACHI|BS_URBAN_ENGINEERING
NED_KARACHI|BS_CONSTRUCTION_ENGINEERING
NED_KARACHI|BS_MACHANICAL_ENGINEERING
NED_KARACHI|BS_TEXTILE_ENGINEERING
NED_KARACHI|BS_INDUSTRIAL_AND_MANUFACTURING_ENGINEERING
NED_KARACHI|BS_AUTOMATIVE_ENGINEERING
NED_KARACHI|BS_ELECTRICAL_ENGINEERING
NED_KARACHI|BS_PETROLEOUM_ENGINEERING
NED_KARACHI|BS_TELECOMMUNICATION_ENGINEERING
NED_KARACHI|BS_COMPUTER_SYSTEM_ENGINEERING
NED_KARACHI|BS_ELECTRONIC_ENGINEERING
NED_KARACHI|BS_CHEMICAL_ENGINEERING
NED_KARACHI|BS_METALLURIGICAL_ENGINEERING
NED_KARACHI|BS_MAETERIAL_ENGINEERING
NED_KARACHI|BS_POLYMER_AND_PETROLEOUM_ENGINEERING
NED_KARACHI|BS_FOOD_ENGINEERING
ARMY_MEDICAL_COLLEGE|MBSS
CMH_LAHORE_MEDICAL_COLLEGE|MBBS
CMH_MULTAN_MEDICAL_COLLEGE|MBBS
CMH_BAHAWALPUR_MEDICAL_COLLEGE|MBBS
CMH_KHARIAN_MEDICAL_COLLEGE|MBBS
HITECH_INSTITUTE_OF_MEDICAL_SCIENCES|MBBS
KARACI_INSTITUTE_OF_MEDICAL_SCIENCES|MBBS
FAZAIA_MEDICAL_COLLEGE_ISLAMABAD|MBBS
BEHRIA_UNIVERSITY_MEDICAL_COLLEGE|MBBS
WAH_MEDICAL_COLLEGE_WAH|MBBS
QUETTA_INSTITUTE_OF_MEDICAL_SCIENCES|MBBS
FOUNDATION_UNIVERSITY_MEDICAL_COLLEGE|MBBS
NUST_SCHOOL_OF_HEALTH_SCIENCES|MBBS
AIR_UNIVERSITY_ISLAMABAD|BS_MACHENICAL_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_ELECTRICAL_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_TELECOM_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_COMPUTER_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_BIOMEDICAL_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_ELECTRONICS_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD| BS_MECHATRONICS_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_CYBER_SECURITY_MANAGEMENT
AIR_UNIVERSITY_ISLAMABAD|BS_COMPUTER_SCIENCE_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_SOFTWARE_ENGINEERING
AIR_UNIVERSITY_ISLAMABAD|BS_INFORMATION_TECHNOLOGY
AIR_UNIVERSITY_ISLAMABAD|BS_DATA_SCIENCES
AIR_UNIVERSITY_ISLAMABAD|BS_GAMING_AND_MULTIMEDIA
AIR_UNIVERSITY_ISLAMABAD|BS_ARTIFICIAL_INTELLIGENCE
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_PAKSITAN_STUDIES
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_ENGLISH
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BACHELOR_OF_BUSINESS_ADMINISTRATION
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_BIOCHEMISTRY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_ECONOMICS
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_CHEMISTRY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_FOOD_SCIENCE_AND_NUTRITION
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_GEOLOGY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_METHAMATICS
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_MICROBIOLOGY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_MEDICAL_LAB_TECHNOLOGY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_PHYSICS
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_PSYCHOLOGY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_SOFTWARE_ENGINEERING
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_ZOOLOGY
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|BS_COMPUTER_SCIENCE
ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY|PHARMD
`;

const universityProgramAliases = {
  PU_ALLAMAIQBAL_CAMPUS: "PU Allama Iqbal Campus",
  UET_LAHORE_CAMPUS: "UET Lahore",
  UET_LAHORE: "UET Lahore",
  GOVERNMENT_COLLEGE_UNIVERSITY_FAISALABAD:
    "Government College University Faisalabad",
  NUST_ISLAMABAD: "NUST Islamabad",
  FAST_LAHORE: "FAST Lahore",
  NED_KARACHI: "NED Karachi",
  ARMY_MEDICAL_COLLEGE: "Army Medical College",
  CMH_LAHORE_MEDICAL_COLLEGE: "CMH Lahore Medical College",
  CMH_MULTAN_MEDICAL_COLLEGE: "CMH Multan Medical College",
  CMH_BAHAWALPUR_MEDICAL_COLLEGE: "CMH Bahawalpur Medical College",
  CMH_KHARIAN_MEDICAL_COLLEGE: "CMH Kharian Medical College",
  HITECH_INSTITUTE_OF_MEDICAL_SCIENCES: "Hi-Tech Institute of Medical Sciences",
  KARACI_INSTITUTE_OF_MEDICAL_SCIENCES: "Karachi Institute of Medical Sciences",
  KARACHI_INSTITUTE_OF_MEDICAL_SCIENCES:
    "Karachi Institute of Medical Sciences",
  FAZAIA_MEDICAL_COLLEGE_ISLAMABAD: "Fazaia Medical College Islamabad",
  BEHRIA_UNIVERSITY_MEDICAL_COLLEGE: "Behria University Medical College",
  WAH_MEDICAL_COLLEGE_WAH: "Wah Medical College Wah",
  QUETTA_INSTITUTE_OF_MEDICAL_SCIENCES: "Quetta Institute of Medical Sciences",
  FOUNDATION_UNIVERSITY_MEDICAL_COLLEGE:
    "Foundation University Medical College",
  NUST_SCHOOL_OF_HEALTH_SCIENCES: "NUST School of Health Sciences",
  AIR_UNIVERSITY_ISLAMABAD: "Air University Islamabad",
  ABBOTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY:
    "Abbottabad University of Science and Technology",
  ABBOTTABAD_UNIVERSITY_OF_SCIENCE_AND_TECHNOLOGY:
    "Abbottabad University of Science and Technology",
};

const normalizeProgramName = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\|/g, "_")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";
  if (/^mbbs$/i.test(normalized)) return "MBBS";
  if (/^mbss$/i.test(normalized)) return "MBSS";
  if (/^bed$/i.test(normalized)) return "BEd";
  if (/^pharmd$/i.test(normalized)) return "PharmD";

  return normalized.replace(/\b[a-zA-Z&]+\b/g, (word) => {
    if (/^(BS|BBA)$/i.test(word)) return word.toUpperCase();
    if (/^OF$/i.test(word)) return "of";
    if (/^AND$/i.test(word)) return "and";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
};

const makeProgram = (name, index) => ({
  name,
  seats: 50 + (index % 4) * 10,
  feeRange: /^MB/i.test(name)
    ? "PKR 1,200,000 - 1,800,000/year"
    : "PKR 250,000 - 500,000/year",
  requiredAggregate: /^MB/i.test(name) ? 82 : 60 + (index % 6),
});

const buildUniversityPrograms = () => {
  const programsByUniversity = new Map();

  programSeedLines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [rawUniversity, ...rawProgramParts] = line.split("|");
      const universityName =
        universityProgramAliases[String(rawUniversity || "").trim()];
      const programName = normalizeProgramName(rawProgramParts.join("|"));
      if (!universityName || !programName) return;

      if (!programsByUniversity.has(universityName)) {
        programsByUniversity.set(universityName, []);
      }

      const programs = programsByUniversity.get(universityName);
      if (!programs.some((program) => program.name === programName)) {
        programs.push(makeProgram(programName, programs.length));
      }
    });

  return programsByUniversity;
};

const universityProgramsByName = buildUniversityPrograms();

const makePaymentMethods = (shortName) => [
  {
    type: "bank",
    title: "Admission Processing Fee",
    accountTitle: `${shortName || "University"} Admissions`,
    bankName: "HBL",
    accountNumber: "001234567890",
    iban: "PK36HABB000000001234567890",
    instructions:
      "Upload the paid challan or transaction screenshot with your application.",
    isActive: true,
  },
];

const universityProfileSeedData = {
  "PU Allama Iqbal Campus": {
    universityName: "University of the Punjab - Allama Iqbal Campus",
    shortName: "PU",
    type: "public",
    established: "1882",
    accreditation: "HEC",
    totalStudents: "45,000+",
    totalPrograms: "80+",
    ranking: "Among Pakistan's oldest and largest public universities",
    color: "#047857",
  },
  "UET Lahore": {
    universityName: "University of Engineering and Technology Lahore",
    shortName: "UET",
    type: "public",
    established: "1921",
    accreditation: "HEC, PEC",
    totalStudents: "12,000+",
    totalPrograms: "35+",
    ranking: "Leading public engineering university",
    color: "#b91c1c",
  },
  "Government College University Faisalabad": {
    universityName: "Government College University Faisalabad",
    shortName: "GCUF",
    type: "public",
    established: "1897",
    accreditation: "HEC",
    totalStudents: "20,000+",
    totalPrograms: "60+",
    ranking: "Major public university in central Punjab",
    color: "#4338ca",
  },
  "FAST Lahore": {
    universityName:
      "National University of Computer and Emerging Sciences - Lahore",
    shortName: "FAST-NUCES",
    type: "private",
    established: "2000",
    accreditation: "HEC, NCEAC, PEC",
    totalStudents: "6,000+",
    totalPrograms: "20+",
    ranking: "Known for computing and engineering education",
    color: "#0f766e",
  },
  "NED Karachi": {
    universityName: "NED University of Engineering and Technology",
    shortName: "NED",
    type: "public",
    established: "1921",
    accreditation: "HEC, PEC",
    totalStudents: "11,000+",
    totalPrograms: "35+",
    ranking: "Prominent engineering university in Sindh",
    color: "#0369a1",
  },
  "Air University Islamabad": {
    universityName: "Air University Islamabad",
    shortName: "AU",
    type: "public",
    established: "2002",
    accreditation: "HEC, PEC",
    totalStudents: "7,000+",
    totalPrograms: "30+",
    ranking:
      "Federally chartered university with engineering and management programs",
    color: "#2563eb",
  },
  "Abbottabad University of Science and Technology": {
    universityName: "Abbottabad University of Science and Technology",
    shortName: "AUST",
    type: "public",
    established: "2015",
    accreditation: "HEC",
    totalStudents: "4,000+",
    totalPrograms: "25+",
    ranking: "Public science and technology university in Hazara",
    color: "#15803d",
  },
};

const makeUniversityProfileSeed = (uni) => {
  const configured = universityProfileSeedData[uni.name] || {};
  const isMedical = /medical|health|army medical|institute of medical/i.test(
    uni.name,
  );
  const programs = universityProgramsByName.get(uni.name) || [];
  const shortName =
    configured.shortName ||
    uni.name
      .replace(
        /\b(university|college|institute|of|and|the|islamabad|lahore|karachi|multan|bahawalpur|kharian|wah)\b/gi,
        "",
      )
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 8);
  const profileType = configured.type || (isMedical ? "private" : "public");
  const logo = makeUniversityLogoDataUrl(
    shortName || uni.name,
    configured.color || (isMedical ? "#be123c" : "#1d4ed8"),
  );
  const admissionsEmail = `admissions@${toSlug(shortName || uni.name)}.edu.pk`;
  const applicationFee = isMedical
    ? 5000
    : profileType === "private"
      ? 3500
      : 2500;

  return {
    universityName: configured.universityName || uni.name,
    shortName,
    type: profileType,
    established: configured.established || (isMedical ? "2008" : "2000"),
    email: admissionsEmail,
    phone: uni.phone,
    website: uni.website,
    address: `Admissions Office, ${uni.name}, ${uni.location}`,
    city: uni.location,
    province: provinceByCity[uni.location] || "",
    postalCode: "",
    about:
      configured.about ||
      `${configured.universityName || uni.name} is seeded in UAAMS with admissions, programs, contact details, and payment information for demo application workflows.`,
    mission:
      configured.mission ||
      "To provide transparent, accessible, and merit-based admissions for students across Pakistan.",
    vision:
      configured.vision ||
      "To support modern higher education through efficient digital admission services.",
    totalStudents:
      configured.totalStudents || (isMedical ? "1,500+" : "5,000+"),
    totalPrograms: String(programs.length),
    ranking:
      configured.ranking ||
      (isMedical
        ? "Recognized medical education institute"
        : "Recognized higher education institute"),
    accreditation:
      configured.accreditation || (isMedical ? "PMDC, HEC" : "HEC"),
    representativeName: uni.representativeName,
    representativePosition: "Admissions Coordinator",
    representativeEmail: admissionsEmail,
    representativePhone: uni.phone,
    representativeProfilePicture: logo,
    logo,
    applicationFee,
    applicationStartDate: new Date("2026-05-01T00:00:00.000Z"),
    applicationEndDate: new Date("2026-06-30T23:59:59.000Z"),
    acceptApplicationsThroughUaams: true,
    allowAutoFillFromStudentProfile: true,
    programs,
    paymentMethods: makePaymentMethods(shortName),
  };
};

const run = async () => {
  await connectDb();

  await Promise.all([
    Application.deleteMany({}),
    Announcement.deleteMany({}),
    BlogPost.deleteMany({}),
    UniversityForm.deleteMany({}),
    UniversityProfile.deleteMany({}),
    StudentProfile.deleteMany({}),
    User.deleteMany({}),
  ]);

  const admin = await User.create({
    name: "System Administrator",
    email: "admin@uaams.com",
    password: "admin123",
    role: ROLES.ADMIN,
    emailVerified: true,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
  });

  const student = await User.create({
    name: "Ayesha Khan",
    email: "student@uaams.com",
    password: "student123",
    role: ROLES.STUDENT,
    emailVerified: true,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
  });

  await StudentProfile.create({
    user: student._id,
    fullName: "Ayesha Khan",
    email: "student@uaams.com",
    city: "Islamabad",
    preferredPrograms: ["BS Computer Science", "BS Software Engineering"],
    preferredCities: ["Islamabad", "Lahore"],
    matricTotalMarks: 1100,
    matricObtainedMarks: 990,
    interTotalMarks: 1100,
    interObtainedMarks: 1010,
  });

  const primaryUniversityLogo = makeUniversityLogoDataUrl("NUST", "#1d4ed8");
  const primaryUniversityPrograms =
    universityProgramsByName.get("NUST Islamabad") || [];
  const university = await User.create({
    name: "NUST Islamabad",
    email: "university@uaams.com",
    username: "nust_islamabad",
    password: "university123",
    role: ROLES.UNIVERSITY,
    emailVerified: true,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
    location: "Islamabad",
    website: "https://www.nust.edu.pk",
    representativeName: "Dr. Sarah Khan",
    phone: "+92-51-0000000",
    profilePicture: primaryUniversityLogo,
  });

  await UniversityProfile.create({
    university: university._id,
    universityName: "National University of Sciences and Technology (NUST)",
    shortName: "NUST",
    type: "public",
    city: "Islamabad",
    province: "Islamabad Capital Territory",
    email: "admissions@nust.edu.pk",
    phone: "+92-51-111-111-687",
    website: "https://www.nust.edu.pk",
    representativeName: "Dr. Sarah Khan",
    representativeEmail: "sarah.khan@nust.edu.pk",
    representativePosition: "Director Admissions",
    representativePhone: "+92-51-111-111-687",
    representativeProfilePicture: primaryUniversityLogo,
    logo: primaryUniversityLogo,
    about:
      "National University of Sciences and Technology (NUST) is seeded in UAAMS with a complete admissions profile for demo application workflows.",
    mission:
      "To provide high-quality education and admissions services through transparent, student-focused systems.",
    vision:
      "To be a leading technology university represented through efficient digital admission management.",
    totalStudents: "15,000+",
    totalPrograms: String(primaryUniversityPrograms.length),
    ranking: "Leading science and technology university in Pakistan",
    accreditation: "HEC, PEC",
    applicationStartDate: new Date("2026-05-01T00:00:00.000Z"),
    applicationEndDate: new Date("2026-06-30T23:59:59.000Z"),
    established: "1991",
    applicationFee: 2500,
    programs: primaryUniversityPrograms,
    paymentMethods: makePaymentMethods("NUST"),
  });

  await UniversityForm.create({
    university: university._id,
    fields: defaultFormFields,
    version: 1,
    updatedBy: university._id,
  });

  const normalizeUsername = (email) => String(email).split("@")[0];

  const additionalUniversities = [
    {
      name: "PU Allama Iqbal Campus",
      email: "pu_allama_iqbal_campus@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Lahore",
      website: "https://www.pu.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-42-00000000",
    },
    {
      name: "UET Lahore",
      email: "uet_lahore@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Lahore",
      website: "https://www.uet.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-42-00000000",
    },
    {
      name: "Government College University Faisalabad",
      email: "government_college_university_faisalabad@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Faisalabad",
      website: "https://gcu.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-41-00000000",
    },
    {
      name: "FAST Lahore",
      email: "fast_lahore@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Lahore",
      website: "https://www.fastschool.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-42-00000000",
    },
    {
      name: "NED Karachi",
      email: "ned_karachi@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Karachi",
      website: "https://www.neduet.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-21-00000000",
    },
    {
      name: "Army Medical College",
      email: "army_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Rawalpindi",
      website: "https://www.amc.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-00000000",
    },
    {
      name: "CMH Lahore Medical College",
      email: "cmh_lahore_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Lahore",
      website: "https://www.cmhlahore.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-42-00000000",
    },
    {
      name: "CMH Multan Medical College",
      email: "cmh_multan_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Multan",
      website: "https://www.cmhmultan.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-61-00000000",
    },
    {
      name: "CMH Bahawalpur Medical College",
      email: "cmh_bahawalpur_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Bahawalpur",
      website: "https://www.cmhbahawalpur.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-62-0000000",
    },
    {
      name: "CMH Kharian Medical College",
      email: "cmh_kharian_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Kharian",
      website: "https://www.cmhkharian.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-53-0000000",
    },
    {
      name: "Hi-Tech Institute of Medical Sciences",
      email: "hitech_institute_of_medical_sciences@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.hitech.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Karachi Institute of Medical Sciences",
      email: "karachi_institute_of_medical_sciences@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Karachi",
      website: "https://www.kims.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-21-0000000",
    },
    {
      name: "Fazaia Medical College Islamabad",
      email: "fazaia_medical_college_islamabad@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.fazaia.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Behria University Medical College",
      email: "behria_university_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.behria.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Wah Medical College Wah",
      email: "wah_medical_college_wah@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Wah",
      website: "https://www.wmc.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Quetta Institute of Medical Sciences",
      email: "quetta_institute_of_medical_sciences@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Quetta",
      website: "https://www.qims.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-81-0000000",
    },
    {
      name: "Foundation University Medical College",
      email: "foundation_university_medical_college@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.foundation.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "NUST School of Health Sciences",
      email: "nust_school_of_health_sciences@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.nust.edu.pk/nhs",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Air University Islamabad",
      email: "air_university_islamabad@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Islamabad",
      website: "https://www.au.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-51-0000000",
    },
    {
      name: "Abbottabad University of Science and Technology",
      email: "abbottabad_university_of_science_and_technology@uaams.com",
      password: "university123",
      role: ROLES.UNIVERSITY,
      emailVerified: true,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
      location: "Abbottabad",
      website: "https://www.aust.edu.pk",
      representativeName: "Admissions Office",
      phone: "+92-992-0000000",
    },
  ];

  const additionalUniversityProfiles = additionalUniversities.map((uni) => ({
    userSeed: uni,
    profileSeed: makeUniversityProfileSeed(uni),
  }));

  const seededAdditionalUniversities = await Promise.all(
    additionalUniversityProfiles.map(({ userSeed, profileSeed }) =>
      User.create({
        ...userSeed,
        username: normalizeUsername(userSeed.email),
        profilePicture: profileSeed.logo,
      }),
    ),
  );

  await Promise.all(
    seededAdditionalUniversities.map((uni, index) =>
      UniversityProfile.create({
        university: uni._id,
        ...additionalUniversityProfiles[index].profileSeed,
      }),
    ),
  );

  await Promise.all(
    seededAdditionalUniversities.map((uni) =>
      UniversityForm.create({
        university: uni._id,
        fields: defaultFormFields,
        version: 1,
        updatedBy: uni._id,
      }),
    ),
  );

  const seededUniversityCredentials = [
    {
      name: university.name,
      identifier: university.username || university.email,
      password: "university123",
    },
    ...seededAdditionalUniversities.map((uni) => ({
      name: uni.name,
      identifier: uni.username || uni.email,
      password: "university123",
    })),
  ];

  console.log("University login credentials:");
  seededUniversityCredentials.forEach((credential) => {
    console.log(
      `${credential.name}: ${credential.identifier} / ${credential.password}`,
    );
  });

  const blogger = await User.create({
    name: "Campus Insights Team",
    email: "blogger@uaams.com",
    username: "campus_writer",
    password: "blogger123",
    role: ROLES.BLOGGER,
    emailVerified: true,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
    managedUniversity: university._id,
  });

  await Announcement.create({
    university: university._id,
    createdBy: university._id,
    title: "Fall 2026 Admissions Open",
    content:
      "Applications are now open for undergraduate programs. Last date to apply is June 30, 2026.",
    type: "deadline",
    category: "Admissions",
    status: "published",
    publishedAt: new Date(),
  });

  await BlogPost.create({
    author: blogger._id,
    university: university._id,
    title: "How to Prepare for NUST Admissions",
    excerpt: "A practical preparation guide for new applicants.",
    content:
      "Start with official eligibility criteria, prepare your documents early, and complete your profile before applying.",
    category: "Admissions",
    tags: ["Admissions", "NUST", "Guidance"],
    status: "published",
    readTime: "2 min",
    publishedAt: new Date(),
    views: 0,
  });

  await Application.create({
    student: student._id,
    university: university._id,
    studentName: "Ayesha Khan",
    email: "student@uaams.com",
    cnic: "12345-1234567-1",
    program: "BS Computer Science",
    aggregate: 90.91,
    matricMarks: 990,
    interMarks: 1010,
    status: "pending",
    formData: {
      1: "Ayesha Khan",
      2: "student@uaams.com",
      3: "+92-300-1234567",
      4: "12345-1234567-1",
      7: 990,
      8: 1010,
    },
    payment: {
      status: "paid",
      amount: 2500,
      method: "card",
      accountLast4: "1234",
      transactionReference: "TXN-10001",
      paidAt: new Date(),
    },
  });

  console.log("Seed completed successfully.\n");
  console.log("Demo credentials:");
  console.log("Student: student@uaams.com / student123");
  console.log("University: university@uaams.com / university123");
  console.log("Blogger: campus_writer / blogger123");
  console.log("Admin: admin@uaams.com / admin123");

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.connection.close();
  process.exit(1);
});
