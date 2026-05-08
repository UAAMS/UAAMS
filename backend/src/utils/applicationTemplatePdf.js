const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const env = require("../config/env");
const {
  SYSTEM_MAPPED_FIELD_IDS,
  SYSTEM_TEMPLATE_RENDER_MODE,
  SYSTEM_TEMPLATE_COLORS,
  SYSTEM_TEMPLATE_STATIC_TEXT,
  SYSTEM_TEMPLATE_SECTIONS,
  SYSTEM_TEMPLATE_FIELD_BLOCKS,
} = require("../config/systemApplicationTemplate");

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const inferMimeTypeByExtension = (filePath = "") => {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "";
};

const parseDataUrl = (value = "") => {
  const match = String(value || "").match(DATA_URL_PATTERN);
  if (!match) return null;
  try {
    return {
      mimeType: String(match[1] || "").toLowerCase(),
      bytes: Buffer.from(String(match[2] || ""), "base64"),
    };
  } catch {
    return null;
  }
};

const loadTemplateFile = async (fileUrl) => {
  const value = String(fileUrl || "").trim();
  if (!value) {
    throw new Error("Template file URL is missing.");
  }

  if (DATA_URL_PATTERN.test(value)) {
    const parsed = parseDataUrl(value);
    if (!parsed || !parsed.bytes?.length) {
      throw new Error("Template file data is invalid.");
    }
    return parsed;
  }

  if (value.startsWith("/uploads/")) {
    const relativePath = value.replace(/^\/uploads\//, "");
    const absolutePath = path.resolve(env.uploadsDir, relativePath);
    return {
      mimeType: inferMimeTypeByExtension(absolutePath),
      bytes: await fs.readFile(absolutePath),
    };
  }

  const normalizedUploadsBase = String(env.uploadsPublicBaseUrl || "").replace(/\/+$/, "");
  if (normalizedUploadsBase && value.startsWith(`${normalizedUploadsBase}/uploads/`)) {
    const relativePath = value.slice(`${normalizedUploadsBase}/uploads/`.length);
    const absolutePath = path.resolve(env.uploadsDir, relativePath);
    return {
      mimeType: inferMimeTypeByExtension(absolutePath),
      bytes: await fs.readFile(absolutePath),
    };
  }

  if (HTTP_URL_PATTERN.test(value)) {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Unable to fetch template file (${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType: String(response.headers.get("content-type") || "").toLowerCase(),
      bytes: Buffer.from(arrayBuffer),
    };
  }

  const absolutePath = path.isAbsolute(value)
    ? value
    : path.resolve(env.uploadsDir, String(value).replace(/^\/+/, ""));
  return {
    mimeType: inferMimeTypeByExtension(absolutePath),
    bytes: await fs.readFile(absolutePath),
  };
};

const normalizePrintableValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  if (text.startsWith("/uploads/") || HTTP_URL_PATTERN.test(text)) {
    const cleanUrl = text.split("#")[0].split("?")[0];
    const fileName = cleanUrl.split("/").filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : text;
  }

  if (DATA_URL_PATTERN.test(text)) {
    return "[file]";
  }

  return text;
};

const pickFirstValue = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const normalizeGenderToken = (value = "") => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (["m", "male", "man"].includes(text)) return "male";
  if (["f", "female", "woman"].includes(text)) return "female";
  if (["other", "non-binary", "nonbinary"].includes(text)) return "other";
  return text;
};

const splitName = (fullName = "") => {
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

const buildFormFieldLabelLookup = (formFields = []) => {
  const lookup = {};
  if (!Array.isArray(formFields)) return lookup;

  formFields.forEach((field) => {
    const id = String(field?.id || "").trim();
    const label = String(field?.label || "").trim();
    if (!id || !label) return;
    lookup[id] = label;
  });

  return lookup;
};

const buildDynamicFieldsSummary = ({ formData = {}, formFields = [] }) => {
  if (!formData || typeof formData !== "object") {
    return "";
  }

  const fieldLabelLookup = buildFormFieldLabelLookup(formFields);
  const entries = Object.entries(formData)
    .map(([fieldId, rawValue]) => ({
      fieldId: String(fieldId || "").trim(),
      value: normalizePrintableValue(rawValue),
    }))
    .filter((item) => item.fieldId && item.value);

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

  const summaryLines = entries
    .filter(
      (item) => !SYSTEM_MAPPED_FIELD_IDS.has(item.fieldId) && !consumedFieldIds.has(item.fieldId),
    )
    .map((item) => {
      const label = String(fieldLabelLookup[item.fieldId] || `Field ${item.fieldId}`).trim();
      return `${label}: ${item.value}`;
    });

  if (summaryLines.length === 0) {
    return "";
  }

  return summaryLines.join(" | ");
};

const META_FIELD_RESOLVERS = {
  "meta.universityName": ({ universityProfile, universityUser }) =>
    universityProfile?.universityName || universityUser?.name || "",
  "meta.universityEmail": ({ universityProfile, universityUser }) =>
    universityProfile?.email || universityUser?.email || "",
  "meta.universityPhone": ({ universityProfile, universityUser }) =>
    universityProfile?.phone || universityUser?.phone || "",
  "meta.universityAddress": ({ universityProfile }) => universityProfile?.address || "",
  "meta.universityCity": ({ universityProfile, universityUser }) =>
    universityProfile?.city || universityUser?.location || "",
  "meta.universityContactSummary": ({ universityProfile, universityUser }) => {
    const lines = [
      pickFirstValue(universityProfile?.universityName, universityUser?.name),
      pickFirstValue(universityProfile?.email, universityUser?.email),
      pickFirstValue(universityProfile?.phone, universityUser?.phone),
      pickFirstValue(universityProfile?.address, universityProfile?.city, universityUser?.location),
    ].filter(Boolean);
    return lines.join("\n");
  },
  "meta.applicationCode": ({ application }) => application?.applicationCode || "",
  "meta.program": ({ application }) => application?.program || "",
  "meta.applicationStatus": ({ application }) => application?.status || "",
  "meta.aggregate": ({ application }) => {
    const aggregate = Number(application?.aggregate || 0);
    return aggregate > 0 ? `${aggregate}%` : "";
  },
  "meta.appliedDate": ({ application }) => formatDate(application?.appliedAt || application?.createdAt),
  "meta.studentFirstName": ({ application, studentProfile, studentUser, formData }) => {
    const fullName = pickFirstValue(
      formData?.["1"],
      application?.studentName,
      studentProfile?.fullName,
      studentUser?.name,
    );
    return splitName(fullName).firstName;
  },
  "meta.studentLastName": ({ application, studentProfile, studentUser, formData }) => {
    const fullName = pickFirstValue(
      formData?.["1"],
      application?.studentName,
      studentProfile?.fullName,
      studentUser?.name,
    );
    const parts = splitName(fullName);
    return parts.lastName || parts.firstName;
  },
  "meta.studentBirthDate": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.dob, studentProfile?.dateOfBirth),
  "meta.studentGender": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.gender, studentProfile?.gender),
  "meta.genderMaleMark": ({ studentProfile, formData }) =>
    normalizeGenderToken(pickFirstValue(formData?.gender, studentProfile?.gender)) === "male"
      ? "X"
      : "",
  "meta.genderFemaleMark": ({ studentProfile, formData }) =>
    normalizeGenderToken(pickFirstValue(formData?.gender, studentProfile?.gender)) === "female"
      ? "X"
      : "",
  "meta.studentNationality": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.nationality, studentProfile?.nationality),
  "meta.studentPhone": ({ application, studentProfile, formData }) =>
    pickFirstValue(formData?.["3"], application?.phone, studentProfile?.phone, studentProfile?.alternatePhone),
  "meta.studentCity": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.city, studentProfile?.city),
  "meta.studentProvince": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.province, studentProfile?.province),
  "meta.studentPostalCode": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.postalCode, studentProfile?.postalCode),
  "meta.studentAddressLine": ({ studentProfile, formData }) =>
    pickFirstValue(formData?.address, studentProfile?.address),
  "meta.studentSignature": ({ application, studentProfile, studentUser, formData }) =>
    pickFirstValue(formData?.["1"], application?.studentName, studentProfile?.fullName, studentUser?.name),
  "meta.studentName": ({ application, studentUser }) =>
    application?.studentName || studentUser?.name || "",
  "meta.studentEmail": ({ application, studentUser }) =>
    application?.email || studentUser?.email || "",
  "meta.studentCnic": ({ application }) => application?.cnic || "",
  "meta.dynamicFieldsSummary": ({ formData, formFields }) =>
    buildDynamicFieldsSummary({ formData, formFields }),
};

const buildTemplateValueLookup = ({
  application,
  universityProfile,
  universityUser,
  studentUser,
  studentProfile,
  formFields,
}) => {
  const lookup = {};
  const formData = application?.formData && typeof application.formData === "object"
    ? application.formData
    : {};

  Object.entries(formData).forEach(([key, value]) => {
    lookup[String(key)] = normalizePrintableValue(value);
  });

  Object.entries(META_FIELD_RESOLVERS).forEach(([key, resolver]) => {
    lookup[key] = normalizePrintableValue(
      resolver({
        application,
        universityProfile,
        universityUser,
        studentUser,
        studentProfile,
        formData,
        formFields,
      })
    );
  });

  return lookup;
};

const hexToRgb = (hexValue = "#0f172a") => {
  const value = String(hexValue || "").trim();
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) {
    return rgb(15 / 255, 23 / 255, 42 / 255);
  }

  return rgb(
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255
  );
};

const drawRectFromTop = (
  page,
  { pageHeight, x, y, width, height, fill, stroke, strokeWidth = 0 },
) => {
  page.drawRectangle({
    x,
    y: pageHeight - y - height,
    width,
    height,
    color: fill ? hexToRgb(fill) : undefined,
    borderColor: stroke ? hexToRgb(stroke) : undefined,
    borderWidth: stroke ? strokeWidth : 0,
  });
};

const drawTextFromTop = (
  page,
  { pageHeight, text, x, y, font, fontSize, color },
) => {
  const content = String(text || "");
  if (!content) return;

  page.drawText(content, {
    x,
    y: pageHeight - y - fontSize,
    size: fontSize,
    font,
    color: hexToRgb(color),
  });
};

const drawGeneratedTemplateBackground = ({ page, pageWidth, pageHeight, font, boldFont }) => {
  drawRectFromTop(page, {
    pageHeight,
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    fill: SYSTEM_TEMPLATE_COLORS.page,
  });
  drawRectFromTop(page, {
    pageHeight,
    x: 28,
    y: 28,
    width: pageWidth - 56,
    height: pageHeight - 56,
    fill: SYSTEM_TEMPLATE_COLORS.page,
    stroke: SYSTEM_TEMPLATE_COLORS.pageBorder,
    strokeWidth: 2,
  });
  drawRectFromTop(page, {
    pageHeight,
    x: 52,
    y: 48,
    width: 1136,
    height: 132,
    fill: SYSTEM_TEMPLATE_COLORS.headerFill,
    stroke: "#9fd6ca",
    strokeWidth: 1.5,
  });
  page.drawLine({
    start: { x: 840, y: pageHeight - 70 },
    end: { x: 840, y: pageHeight - 158 },
    thickness: 2,
    color: hexToRgb("#9fd6ca"),
  });

  SYSTEM_TEMPLATE_STATIC_TEXT.forEach((textBlock) => {
    drawTextFromTop(page, {
      pageHeight,
      text: textBlock.text,
      x: textBlock.x,
      y: textBlock.y,
      font: String(textBlock.fontWeight || "") === "700" ? boldFont : font,
      fontSize: textBlock.fontSize,
      color: textBlock.color,
    });
  });

  SYSTEM_TEMPLATE_SECTIONS.forEach((section) => {
    drawRectFromTop(page, {
      pageHeight,
      x: section.x,
      y: section.y,
      width: section.width,
      height: section.height,
      fill: SYSTEM_TEMPLATE_COLORS.sectionFill,
      stroke: SYSTEM_TEMPLATE_COLORS.sectionBorder,
      strokeWidth: 1.5,
    });
    drawTextFromTop(page, {
      pageHeight,
      text: section.title,
      x: section.x + 18,
      y: section.y + 18,
      font: boldFont,
      fontSize: 18,
      color: SYSTEM_TEMPLATE_COLORS.headerAccent,
    });
  });

  SYSTEM_TEMPLATE_FIELD_BLOCKS.forEach((field) => {
    drawTextFromTop(page, {
      pageHeight,
      text: field.label,
      x: field.x,
      y: field.y - 24,
      font: boldFont,
      fontSize: 14,
      color: SYSTEM_TEMPLATE_COLORS.label,
    });
    drawRectFromTop(page, {
      pageHeight,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      fill: SYSTEM_TEMPLATE_COLORS.fieldFill,
      stroke: SYSTEM_TEMPLATE_COLORS.fieldBorder,
      strokeWidth: 1.25,
    });
  });
};

const splitLongToken = ({ token, font, fontSize, maxWidth }) => {
  const text = String(token || "");
  if (!text || font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
    return [text].filter(Boolean);
  }

  const chunks = [];
  let current = "";
  Array.from(text).forEach((character) => {
    const candidate = `${current}${character}`;
    if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      return;
    }
    chunks.push(current);
    current = character;
  });
  if (current) {
    chunks.push(current);
  }
  return chunks;
};

const wrapText = ({ text, font, fontSize, maxWidth }) => {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return [];

  const rawLines = normalized.split("\n");
  if (!maxWidth || maxWidth <= 0) {
    return rawLines;
  }

  const wrapped = [];
  rawLines.forEach((line) => {
    const words = line
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => splitLongToken({ token: word, font, fontSize, maxWidth }));
    if (words.length === 0) {
      wrapped.push("");
      return;
    }

    let current = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const word = words[index];
      const candidate = `${current} ${word}`;
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
      if (candidateWidth <= maxWidth) {
        current = candidate;
      } else {
        wrapped.push(current);
        current = word;
      }
    }
    wrapped.push(current);
  });

  return wrapped;
};

const generateApplicationTemplatePdf = async ({
  template,
  application,
  universityProfile,
  universityUser,
  studentUser,
  studentProfile,
  formFields = [],
}) => {
  const usesGeneratedTemplate =
    String(template?.renderMode || "").toLowerCase() === SYSTEM_TEMPLATE_RENDER_MODE;

  if (!usesGeneratedTemplate && !template?.fileUrl) {
    throw new Error("No active template is configured for this university.");
  }

  const pageWidth = Math.max(200, toNumber(template.pageWidth, 1240));
  const pageHeight = Math.max(200, toNumber(template.pageHeight, 1754));
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (usesGeneratedTemplate) {
    drawGeneratedTemplateBackground({ page, pageWidth, pageHeight, font, boldFont });
  } else {
    const { bytes, mimeType } = await loadTemplateFile(template.fileUrl);
    const detectedMime = String(mimeType || template?.mimeType || "").toLowerCase();
    let backgroundImage = null;

    if (detectedMime.includes("png")) {
      backgroundImage = await pdfDoc.embedPng(bytes);
    } else if (detectedMime.includes("jpeg") || detectedMime.includes("jpg")) {
      backgroundImage = await pdfDoc.embedJpg(bytes);
    } else {
      throw new Error("Template background must be PNG or JPEG for PDF generation.");
    }

    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const valueLookup = buildTemplateValueLookup({
    application,
    universityProfile,
    universityUser,
    studentUser,
    studentProfile,
    formFields,
  });
  const mappings = Array.isArray(template?.fieldMappings) ? template.fieldMappings : [];

  mappings.forEach((mapping) => {
    const fieldId = String(mapping?.fieldId || "").trim();
    if (!fieldId) return;

    const value = normalizePrintableValue(valueLookup[fieldId] || "");
    if (!value) return;

    const fontSize = Math.max(8, toNumber(mapping?.fontSize, 12));
    const x = Math.max(0, toNumber(mapping?.x, 0));
    const yTop = Math.max(0, toNumber(mapping?.y, 0));
    const width = Math.max(0, toNumber(mapping?.width, 200));
    const height = Math.max(fontSize + 2, toNumber(mapping?.height, 24));
    const textAlign = String(mapping?.textAlign || "left").toLowerCase();
    const color = hexToRgb(mapping?.color);
    const lineHeight = fontSize + 2;
    const maxLines = Math.max(1, Math.floor(height / lineHeight));
    const lines = wrapText({ text: value, font, fontSize, maxWidth: width }).slice(0, maxLines);

    lines.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      let drawX = x;
      if (textAlign === "center") {
        drawX = x + (width - textWidth) / 2;
      } else if (textAlign === "right") {
        drawX = x + width - textWidth;
      }

      const y = pageHeight - yTop - fontSize - index * lineHeight;
      if (y < 0) return;

      page.drawText(line, {
        x: Math.max(0, drawX),
        y,
        size: fontSize,
        font,
        color,
      });
    });
  });

  return Buffer.from(await pdfDoc.save());
};

module.exports = {
  generateApplicationTemplatePdf,
  buildTemplateValueLookup,
};
