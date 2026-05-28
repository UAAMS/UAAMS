import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Heart,
  MessageCircle,
  Reply,
  Search,
  Send,
  School,
  Tag,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Avatar } from "../shared/Avatar";
import { ImagePreviewModal } from "../shared/ImagePreviewModal";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  addBlogComment,
  fetchBlogComments,
  fetchStudentBlogs,
  markBlogPostViewed,
  toggleBlogCommentLike,
  toggleBlogPostLike,
} from "../../store/slices/blogsSlice";

const formatDateTime = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function StudentBlog() {
  const dispatch = useAppDispatch();
  const {
    posts,
    postsLoading: isLoading,
    postsError: error,
    commentsByPost,
    loadingCommentsByPost,
    commentErrorsByPost,
    postingCommentByPost,
  } = useAppSelector((state) => state.blogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [newComment, setNewComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [activeReplyInput, setActiveReplyInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const comments = useMemo(
    () => (selectedPostId ? commentsByPost[selectedPostId] || [] : []),
    [commentsByPost, selectedPostId],
  );
  const isLoadingComments = Boolean(
    selectedPostId ? loadingCommentsByPost[selectedPostId] : false,
  );
  const commentError = selectedPostId ? commentErrorsByPost[selectedPostId] || "" : "";
  const isSubmitting = Boolean(selectedPostId ? postingCommentByPost[selectedPostId] : false);

  useEffect(() => {
    dispatch(fetchStudentBlogs());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        dispatch(fetchStudentBlogs());
        if (selectedPostId) {
          dispatch(fetchBlogComments(selectedPostId));
        }
      }
    });

    return () => unsubscribe();
  }, [dispatch, selectedPostId]);

  const location = useLocation();

  useEffect(() => {
    // If navigated with a postId in state (from notification), open that post
    const postIdFromState = location?.state?.postId;
    if (postIdFromState) {
      setSelectedPostId(postIdFromState);
    }
    // Do not clear location.state here; keep behavior simple
  }, [location?.state]);

  useEffect(() => {
    if (!selectedPostId) return;
    const exists = posts.some((post) => post.id === selectedPostId);
    if (!exists) {
      setSelectedPostId("");
      setActionError("");
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (!selectedPostId) return;
    dispatch(markBlogPostViewed(selectedPostId));
    dispatch(fetchBlogComments(selectedPostId));
  }, [dispatch, selectedPostId]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId],
  );

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(posts.map((post) => post.category).filter(Boolean)))],
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesSearch =
        !search ||
        post.title.toLowerCase().includes(search) ||
        post.excerpt.toLowerCase().includes(search) ||
        post.tags.some((tag) => tag.toLowerCase().includes(search));
      const matchesCategory = selectedCategory === "all" || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [posts, searchQuery, selectedCategory]);

  const handleTogglePostLike = async (postId) => {
    setActionError("");
    try {
      await dispatch(toggleBlogPostLike(postId)).unwrap();
    } catch (updateError) {
      setActionError(updateError?.message || "Unable to update like.");
    }
  };

  const handleAddComment = async () => {
    const content = String(newComment || "").trim();
    if (!content || !selectedPostId) return;

    setActionError("");
    try {
      await dispatch(addBlogComment({ postId: selectedPostId, content })).unwrap();
      dispatch(fetchStudentBlogs());
      setNewComment("");
    } catch (submitError) {
      setActionError(submitError?.message || "Unable to add comment.");
    }
  };

  const handleAddReply = async (parentCommentId) => {
    const content = String(replyDrafts[parentCommentId] || "").trim();
    if (!content || !selectedPostId) return;

    setActionError("");
    try {
      await dispatch(
        addBlogComment({
          postId: selectedPostId,
          content,
          parentCommentId,
        }),
      ).unwrap();
      dispatch(fetchStudentBlogs());
      setReplyDrafts((previous) => ({ ...previous, [parentCommentId]: "" }));
      setActiveReplyInput("");
    } catch (submitError) {
      setActionError(submitError?.message || "Unable to add reply.");
    }
  };

  const handleToggleCommentLike = async (commentId) => {
    if (!selectedPostId) return;
    setActionError("");

    try {
      await dispatch(
        toggleBlogCommentLike({ postId: selectedPostId, commentId }),
      ).unwrap();
      dispatch(fetchStudentBlogs());
    } catch (updateError) {
      setActionError(updateError?.message || "Unable to update comment like.");
    }
  };

  if (selectedPost) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setSelectedPostId("");
            setActionError("");
          }}
          className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
        >
          {"<-"} Back to Blog
        </button>

        <Card className="bg-white border border-slate-200 overflow-hidden">
          {selectedPost.imageUrl ? (
            <button
              type="button"
              onClick={() => setImagePreviewUrl(selectedPost.imageUrl)}
              className="block w-full"
              title="Open image preview"
            >
              <img
                src={selectedPost.imageUrl}
                alt={selectedPost.title}
                className="h-64 w-full object-cover sm:h-96"
              />
            </button>
          ) : (
            <div className="h-56 bg-slate-100 flex items-center justify-center text-slate-500">
              No cover image
            </div>
          )}

          <div className="p-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className="bg-emerald-100 text-emerald-700">{selectedPost.category}</Badge>
              {selectedPost.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-slate-600">
                  {tag}
                </Badge>
              ))}
            </div>

            <h1 className="text-slate-900 mb-4">{selectedPost.title}</h1>

            <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-slate-200 sm:flex-row sm:items-center">
              <Avatar
                src={
                  selectedPost.authorProfilePicture ||
                  selectedPost.representativeProfilePicture ||
                  selectedPost.universityLogo
                }
                name={selectedPost.author}
                size="lg"
                className="bg-emerald-50 text-emerald-700"
              />
              <div className="flex-1">
                <div className="text-slate-900">{selectedPost.author}</div>
                <div className="text-sm text-slate-600">
                  {selectedPost.authorTitle} | {selectedPost.university}
                </div>
              </div>
              {selectedPost.universityLogo ? (
                <Avatar
                  src={selectedPost.universityLogo}
                  name={selectedPost.university}
                  size="sm"
                  className="rounded-lg bg-white"
                />
              ) : null}
              <div className="text-sm text-slate-500 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {selectedPost.publishDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedPost.readTime}
                </span>
              </div>
            </div>

            <div className="prose max-w-none">
              {selectedPost.content.split("\n").map((paragraph, index) => (
                <p key={`${selectedPost.id}-paragraph-${index}`} className="text-slate-700 mb-4 whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>{selectedPost.views.toLocaleString()} views</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTogglePostLike(selectedPost.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                    selectedPost.likedByMe
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${selectedPost.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                  {selectedPost.likesCount}
                </button>
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <MessageCircle className="h-4 w-4" />
                  {selectedPost.commentsCount}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <Reply className="h-4 w-4" />
                  {selectedPost.repliesCount}
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-slate-900">Comments</h3>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Write a comment..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={isSubmitting || !newComment.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-70"
                >
                  <Send className="h-4 w-4" />
                  Post
                </button>
              </div>

              {actionError || commentError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError || commentError}
                </p>
              ) : null}

              {isLoadingComments ? (
                <p className="text-sm text-slate-600">Loading comments...</p>
              ) : null}

              {!isLoadingComments && comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet. Start the discussion.</p>
              ) : null}

              {!isLoadingComments && comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      replyDraft={replyDrafts[comment.id] || ""}
                      isReplyInputOpen={activeReplyInput === comment.id}
                      onReplyToggle={() =>
                        setActiveReplyInput((previous) => (previous === comment.id ? "" : comment.id))
                      }
                      onReplyDraftChange={(value) =>
                        setReplyDrafts((previous) => ({ ...previous, [comment.id]: value }))
                      }
                      onReplySubmit={() => handleAddReply(comment.id)}
                      onCommentLike={handleToggleCommentLike}
                      onReplyLike={handleToggleCommentLike}
                      isSubmitting={isSubmitting}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
        <ImagePreviewModal
          imageUrl={imagePreviewUrl}
          alt={selectedPost.title}
          onClose={() => setImagePreviewUrl("")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">University Blog</h1>
        <p className="uaams-page-description">Insights and guidance from universities.</p>
      </div>

      <Card className="bg-white border border-slate-200 p-4 sm:p-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {category === "all" ? "All" : category}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="bg-white border border-slate-200 p-12 text-center text-sm text-slate-600">
          Loading blog posts...
        </Card>
      ) : null}

      {!isLoading && error ? (
        <Card className="bg-red-50 border border-red-200 p-6 text-sm text-red-700">{error}</Card>
      ) : null}

      {!isLoading && !error && filteredPosts.length === 0 ? (
        <Card className="bg-white border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-slate-900 mb-2">No articles found</h3>
          <p className="text-slate-600">Try adjusting your search or filters</p>
        </Card>
      ) : null}

      {!isLoading && !error && filteredPosts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredPosts.map((post) => (
            <Card
              key={post.id}
              className="bg-white border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedPostId(post.id)}
            >
              {post.imageUrl ? (
                <img src={post.imageUrl} alt={post.title} className="w-full h-48 object-cover" />
              ) : (
                <div className="h-48 bg-slate-100 flex items-center justify-center text-slate-500">
                  No cover image
                </div>
              )}

              <div className="p-6">
                <div className="flex flex-col items-start mb-3 sm:flex-row sm:items-center sm:justify-between w-full">
                  <div className="flex items-center gap-2">
                    {post.universityLogo ? (
                      <Avatar
                      src={post.universityLogo}
                      name={post.university}
                      size="sm"
                      className="rounded-lg bg-white"
                      />
                    ) : (
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="text-sm text-slate-600">{post.university}</span>
                  </div>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs items-end">{post.category}</Badge>
                </div>

                <h3 className="text-slate-900 mb-2 line-clamp-2">{post.title}</h3>

                <p className="text-slate-600 text-sm mb-4 line-clamp-3">{post.excerpt}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="mb-4 flex items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                    {post.likesCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {post.commentsCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Reply className="h-3.5 w-3.5" />
                    {post.repliesCount}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {post.publishDate}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Read More
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentItem({
  comment,
  replyDraft,
  isReplyInputOpen,
  onReplyToggle,
  onReplyDraftChange,
  onReplySubmit,
  onCommentLike,
  onReplyLike,
  isSubmitting,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-900">{comment.student?.name || "Student"}</p>
          <p className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</p>
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{comment.content}</p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCommentLike(comment.id)}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
            comment.likedByMe
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
          {comment.likesCount}
        </button>
        <button
          type="button"
          onClick={onReplyToggle}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          <Reply className="h-3.5 w-3.5" />
          Reply
        </button>
      </div>

      {isReplyInputOpen ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={replyDraft}
            onChange={(event) => onReplyDraftChange(event.target.value)}
            placeholder="Write a reply..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={onReplySubmit}
            disabled={!replyDraft.trim() || isSubmitting}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-70"
          >
            Send
          </button>
        </div>
      ) : null}

      {Array.isArray(comment.replies) && comment.replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-l border-slate-300 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-900">{reply.student?.name || "Student"}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(reply.createdAt)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{reply.content}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onReplyLike(reply.id)}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                    reply.likedByMe
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${reply.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                  {reply.likesCount}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { StudentBlog };
