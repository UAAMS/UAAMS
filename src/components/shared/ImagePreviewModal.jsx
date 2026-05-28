import { X } from "lucide-react";

export function ImagePreviewModal({ imageUrl, alt = "Image preview", onClose }) {
  if (!imageUrl) return null;

  return (
    <div className="uaams-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="relative flex max-h-full w-full max-w-6xl items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
          Close
        </button>
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
