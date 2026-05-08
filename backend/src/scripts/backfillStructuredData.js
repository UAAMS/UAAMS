const connectDb = require("../config/db");
const { initializeStructuredStore, getStructuredStore } = require("../structured/store");
const {
  upsertStructuredUserById,
  upsertStructuredStudentProfileByUserId,
  upsertStructuredUniversityByUserId,
  upsertStructuredApplicationById,
} = require("../structured/syncService");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const Application = require("../models/Application");

const processInBatches = async (items, handler, label) => {
  const total = items.length;
  let processed = 0;
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    await handler(item);
    processed += 1;
    if (processed % 50 === 0 || processed === total) {
      // eslint-disable-next-line no-console
      console.log(`[backfill] ${label}: ${processed}/${total}`);
    }
  }
};

const run = async () => {
  await connectDb();
  await initializeStructuredStore();
  const store = getStructuredStore();
  if (!store.enabled || !store.ready) {
    throw new Error("PostgreSQL is not enabled/ready. Set ENABLE_PSQL=true and PG_* vars first.");
  }

  const [users, studentProfiles, universityProfiles, applications] = await Promise.all([
    User.find({}, { _id: 1 }).lean(),
    StudentProfile.find({}, { user: 1 }).lean(),
    UniversityProfile.find({}, { university: 1 }).lean(),
    Application.find({}, { _id: 1 }).lean(),
  ]);

  await processInBatches(
    users,
    async (item) => {
      await upsertStructuredUserById(item._id);
    },
    "users"
  );

  await processInBatches(
    studentProfiles,
    async (item) => {
      await upsertStructuredStudentProfileByUserId(item.user);
    },
    "student_profiles"
  );

  await processInBatches(
    universityProfiles,
    async (item) => {
      await upsertStructuredUniversityByUserId(item.university);
    },
    "university_profiles"
  );

  await processInBatches(
    applications,
    async (item) => {
      await upsertStructuredApplicationById(item._id);
    },
    "applications"
  );

  // eslint-disable-next-line no-console
  console.log("[backfill] completed successfully");
  process.exit(0);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[backfill] failed", error);
  process.exit(1);
});
