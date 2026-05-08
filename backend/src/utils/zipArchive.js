const { Buffer } = require("node:buffer");

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const toDosDateTime = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = Math.max(1980, safeDate.getFullYear());
  const dosTime =
    (safeDate.getHours() << 11) |
    (safeDate.getMinutes() << 5) |
    Math.floor(safeDate.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((safeDate.getMonth() + 1) << 5) |
    safeDate.getDate();
  return { dosDate, dosTime };
};

const normalizeZipPath = (value, fallback = "file.bin") => {
  const normalized = String(value || fallback)
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[<>:"|?*\u0000-\u001f]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
  return normalized || fallback;
};

const createZipArchive = (entries = []) => {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes || "");
    const nameBuffer = Buffer.from(normalizeZipPath(entry.name), "utf8");
    const checksum = crc32(bytes);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(bytes.length, 18);
    localHeader.writeUInt32LE(bytes.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileParts.push(localHeader, nameBuffer, bytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(bytes.length, 20);
    centralHeader.writeUInt32LE(bytes.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + bytes.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, endRecord]);
};

module.exports = {
  createZipArchive,
};
