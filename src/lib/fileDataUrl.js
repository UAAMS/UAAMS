const readRawFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read selected file."));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process selected image."));
    image.src = dataUrl;
  });

const isCompressibleImage = (file) =>
  Boolean(file?.type?.startsWith("image/")) && file.type !== "image/gif";

const compressImageDataUrl = async (
  file,
  { maxDimension = 1600, quality = 0.82 } = {},
) => {
  const originalDataUrl = await readRawFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(originalDataUrl);

  const ratio = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1));
  const targetWidth = Math.max(1, Math.round((image.width || 1) * ratio));
  const targetHeight = Math.max(1, Math.round((image.height || 1) * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const compressed = canvas.toDataURL("image/jpeg", quality);

  return compressed.length < originalDataUrl.length ? compressed : originalDataUrl;
};

const readFileAsDataUrl = async (file, options = {}) => {
  if (!file) return "";

  const { compressImages = true, maxDimension = 1600, quality = 0.82 } = options;

  if (compressImages && isCompressibleImage(file)) {
    try {
      return await compressImageDataUrl(file, { maxDimension, quality });
    } catch {
      return readRawFileAsDataUrl(file);
    }
  }

  return readRawFileAsDataUrl(file);
};

const getFileNameFromPath = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || normalized;
};

export { readFileAsDataUrl, getFileNameFromPath };
