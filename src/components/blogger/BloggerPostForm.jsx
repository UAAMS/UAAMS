import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { isSupportedProfileImage } from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  createBloggerPost,
  updateBloggerPost,
} from "../../store/slices/bloggerPostsSlice";

const initialFormState = {
  title: "",
  excerpt: "",
  content: "",
  category: "General",
  tags: "",
  imageUrl: "",
  status: "draft",
};

const buildPayload = (formData) => ({
  title: formData.title,
  excerpt: formData.excerpt,
  content: formData.content,
  category: formData.category,
  tags: formData.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  imageUrl: formData.imageUrl,
  status: formData.status,
});

export function BloggerPostForm({ post, mode = "create" }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { saving, mutationError } = useAppSelector((state) => state.bloggerPosts);

  const [formData, setFormData] = useState(initialFormState);
  const [imageFileName, setImageFileName] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        tags: post.tags.join(", "),
        imageUrl: post.imageUrl,
        status: post.status,
      });
      setImageFileName("");
      setFormError("");
    } else {
      setFormData(initialFormState);
      setImageFileName("");
      setFormError("");
    }
  }, [post]);

  const handleImageFileChange = async (file) => {
    if (!file) return;

    if (!isSupportedProfileImage(file)) {
      setImageFileName("");
      setFormError("Blog image must be a JPG or PNG file.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({ ...previous, imageUrl: dataUrl }));
      setImageFileName(file.name);
      setFormError("");
    } catch {
      setFormError("Unable to read selected image file.");
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      const payload = buildPayload(formData);

      if (mode === "edit" && post?.id) {
        await dispatch(updateBloggerPost({ postId: post.id, payload })).unwrap();
      } else {
        await dispatch(createBloggerPost(payload)).unwrap();
      }

      navigate("/blogger", { replace: true });
    } catch (saveError) {
      const message =
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to save post.";
      setFormError(message);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm text-slate-700">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, title: event.target.value }))
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-700">Short Summary</label>
        <textarea
          value={formData.excerpt}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, excerpt: event.target.value }))
          }
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-700">Content</label>
        <textarea
          value={formData.content}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, content: event.target.value }))
          }
          rows={8}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-700">Category</label>
          <input
            type="text"
            value={formData.category}
            onChange={(event) =>
              setFormData((previous) => ({ ...previous, category: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">Tags (comma separated)</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(event) =>
              setFormData((previous) => ({ ...previous, tags: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-700">Image URL</label>
          <input
            type="text"
            value={formData.imageUrl}
            onChange={(event) => {
              setFormData((previous) => ({ ...previous, imageUrl: event.target.value }));
              setImageFileName("");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/image.jpg"
          />
          <p className="mt-1 text-xs text-slate-500">Use a URL or upload an image below.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">Upload Image</label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(event) => {
              handleImageFileChange(event.target.files?.[0]);
              if (
                event.target.files?.[0] &&
                !isSupportedProfileImage(event.target.files[0])
              ) {
                event.target.value = "";
              }
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {imageFileName ? (
            <p className="mt-1 text-xs text-emerald-700">Selected: {imageFileName}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-700">Status</label>
        <select
          value={formData.status}
          onChange={(event) =>
            setFormData((previous) => ({ ...previous, status: event.target.value }))
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {formError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      {mutationError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {mutationError}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
        >
          {saving ? "Saving..." : mode === "edit" ? "Update Post" : "Create Post"}
        </button>
      </div>
    </form>
  );
}
