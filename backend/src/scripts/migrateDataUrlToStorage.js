const mongoose = require("mongoose");
const connectDb = require("../config/db");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const Announcement = require("../models/Announcement");
const BlogPost = require("../models/BlogPost");
const Application = require("../models/Application");
const { isDataUrl, persistMaybeDataUrl, persistDataUrlsInValue } = require("../utils/fileStorage");

const DATA_URL_REGEX = /^data:/i;

const summary = {
  studentProfilesUpdated: 0,
  universityProfilesUpdated: 0,
  announcementsUpdated: 0,
  blogsUpdated: 0,
  applicationsUpdated: 0,
  applicationFormFilesConverted: 0,
};

const migrateStudentProfiles = async () => {
  const cursor = StudentProfile.find({
    $or: [
      { profilePicture: DATA_URL_REGEX },
      { domicileDocument: DATA_URL_REGEX },
      { matricResultDocument: DATA_URL_REGEX },
      { interResultDocument: DATA_URL_REGEX },
    ],
  }).cursor();

  for await (const profile of cursor) {
    let changed = false;
    const folder = `student-profiles/${String(profile.user)}`;

    if (isDataUrl(profile.profilePicture)) {
      profile.profilePicture = await persistMaybeDataUrl({
        value: profile.profilePicture,
        folder,
        preferredName: profile.profilePictureFileName || "profile-picture",
      });
      changed = true;
    }

    if (isDataUrl(profile.domicileDocument)) {
      profile.domicileDocument = await persistMaybeDataUrl({
        value: profile.domicileDocument,
        folder,
        preferredName: profile.domicileFileName || "domicile-document",
      });
      changed = true;
    }

    if (isDataUrl(profile.matricResultDocument)) {
      profile.matricResultDocument = await persistMaybeDataUrl({
        value: profile.matricResultDocument,
        folder,
        preferredName: profile.matricResultFileName || "matric-result",
      });
      changed = true;
    }

    if (isDataUrl(profile.interResultDocument)) {
      profile.interResultDocument = await persistMaybeDataUrl({
        value: profile.interResultDocument,
        folder,
        preferredName: profile.interResultFileName || "inter-result",
      });
      changed = true;
    }

    if (changed) {
      await profile.save();
      summary.studentProfilesUpdated += 1;
    }
  }
};

const migrateUniversityProfiles = async () => {
  const cursor = UniversityProfile.find({
    logo: DATA_URL_REGEX,
  }).cursor();

  for await (const profile of cursor) {
    profile.logo = await persistMaybeDataUrl({
      value: profile.logo,
      folder: `university-profiles/${String(profile.university)}`,
      preferredName: profile.shortName || profile.universityName || "university-logo",
    });
    await profile.save();
    summary.universityProfilesUpdated += 1;
  }
};

const migrateAnnouncements = async () => {
  const cursor = Announcement.find({
    attachmentUrl: DATA_URL_REGEX,
  }).cursor();

  for await (const announcement of cursor) {
    announcement.attachmentUrl = await persistMaybeDataUrl({
      value: announcement.attachmentUrl,
      folder: `announcements/${String(announcement.university)}`,
      preferredName: announcement.attachmentName || announcement.title || "announcement-attachment",
    });
    await announcement.save();
    summary.announcementsUpdated += 1;
  }
};

const migrateBlogs = async () => {
  const cursor = BlogPost.find({
    imageUrl: DATA_URL_REGEX,
  }).cursor();

  for await (const post of cursor) {
    post.imageUrl = await persistMaybeDataUrl({
      value: post.imageUrl,
      folder: `blogs/${String(post.university)}`,
      preferredName: post.title || "blog-image",
    });
    await post.save();
    summary.blogsUpdated += 1;
  }
};

const migrateApplications = async () => {
  const cursor = Application.find({}).cursor();

  for await (const application of cursor) {
    let changed = false;

    if (isDataUrl(application.rollNumber?.slipFileUrl)) {
      application.rollNumber.slipFileUrl = await persistMaybeDataUrl({
        value: application.rollNumber.slipFileUrl,
        folder: `applications/${String(application._id)}/roll-slips`,
        preferredName: application.rollNumber?.slipFileName || "roll-slip",
      });
      changed = true;
    }

    if (isDataUrl(application.admissionLetter?.fileUrl)) {
      application.admissionLetter.fileUrl = await persistMaybeDataUrl({
        value: application.admissionLetter.fileUrl,
        folder: `applications/${String(application._id)}/admission-letters`,
        preferredName: application.admissionLetter?.fileName || "admission-letter",
      });
      changed = true;
    }

    const { value: normalizedFormData, convertedCount } = await persistDataUrlsInValue(
      application.formData || {},
      {
        folder: `applications/${String(application._id)}/form-data`,
        preferredNamePrefix: "form-field",
      }
    );

    if (convertedCount > 0) {
      application.formData = normalizedFormData;
      summary.applicationFormFilesConverted += convertedCount;
      changed = true;
    }

    if (changed) {
      await application.save();
      summary.applicationsUpdated += 1;
    }
  }
};

const run = async () => {
  await connectDb();
  // eslint-disable-next-line no-console
  console.log("[migration] Starting data URL to file path migration...");

  await migrateStudentProfiles();
  await migrateUniversityProfiles();
  await migrateAnnouncements();
  await migrateBlogs();
  await migrateApplications();

  // eslint-disable-next-line no-console
  console.log("[migration] Completed.");
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ...summary,
      },
      null,
      2
    )
  );
};

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("[migration] Failed:", error?.message || error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
