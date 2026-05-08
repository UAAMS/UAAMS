import { Trash2, MessageCircle, Heart } from "lucide-react";
import { useState } from "react";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function CommentThread({ comment, onDelete, isDeletingIds }) {
  const [expanded, setExpanded] = useState(true);
  const isDeleting = isDeletingIds.includes(String(comment.id));
  const replies = comment.replies || [];

  return (
    <div className="border-l-2 border-slate-200 pl-4 space-y-3">
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-slate-900">
                {comment.author?.name || comment.student?.name || "Anonymous"}
              </span>
              <span className="text-xs text-slate-500">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {comment.likesCount ?? comment.likes?.length ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {replies.length}
              </span>
            </div>
            {replies.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                <span className="font-medium">Reply thread ({replies.length})</span>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="text-blue-600 hover:underline"
                >
                  {expanded ? "Collapse thread" : "Expand thread"}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            disabled={isDeleting}
            className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50 disabled:opacity-60"
            title="Delete comment and replies"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {replies.length > 0 && expanded && (
        <div className="space-y-3">
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              isDeletingIds={isDeletingIds}
            />
          ))}
        </div>
      )}

      {replies.length > 0 && !expanded && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {replies.length} repl{replies.length === 1 ? "y" : "ies"} hidden. Expand to view.
        </div>
      )}
    </div>
  );
}

export function BlogCommentManager({
  comments = [],
  loading = false,
  error = null,
  onDelete,
  isDeletingIds = [],
  emptyMessage = "No comments yet",
}) {
  const topLevelComments = comments.filter((c) => !c.parentCommentId);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading comments...
        </div>
      )}

      {!loading && topLevelComments.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
          {emptyMessage}
        </div>
      ) : null}

      <div className="space-y-6">
        {topLevelComments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            onDelete={onDelete}
            isDeletingIds={isDeletingIds}
          />
        ))}
      </div>
    </div>
  );
}
