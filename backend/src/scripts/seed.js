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
const { ROLES, UNIVERSITY_APPROVAL, USER_STATUS } = require("../constants/roles");

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
    preferredPrograms: ["Computer Science", "Software Engineering"],
    preferredCities: ["Islamabad", "Lahore"],
    matricTotalMarks: 1100,
    matricObtainedMarks: 990,
    interTotalMarks: 1100,
    interObtainedMarks: 1010,
  });

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
    established: "1991",
    applicationFee: 2500,
    programs: [
      {
        name: "Computer Science",
        seats: 120,
        feeRange: "PKR 400,000 - 500,000/year",
        requiredAggregate: 75,
      },
      {
        name: "Software Engineering",
        seats: 80,
        feeRange: "PKR 420,000 - 520,000/year",
        requiredAggregate: 74,
      },
    ],
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

  const seededAdditionalUniversities = await Promise.all(
    additionalUniversities.map((uni) =>
      User.create({ ...uni, username: normalizeUsername(uni.email) }),
    )
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
    program: "Computer Science",
    aggregate: 90.91,
    matricMarks: 990,
    interMarks: 1010,
    status: "pending",
    formData: {
      "1": "Ayesha Khan",
      "2": "student@uaams.com",
      "3": "+92-300-1234567",
      "4": "12345-1234567-1",
      "7": 990,
      "8": 1010,
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
