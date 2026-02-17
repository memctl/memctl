"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { slugify } from "@/lib/utils";

interface PostEditorProps {
  mode: "create" | "edit";
  initialData?: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImageUrl: string;
    status: string;
  };
}

export function PostEditor({ mode, initialData }: PostEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initialData?.slug);
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.coverImageUrl ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "draft");

  const handleTitleChange = useCallback(
    (val: string) => {
      setTitle(val);
      if (!slugManual) {
        setSlug(slugify(val));
      }
    },
    [slugManual],
  );

  async function handleSave() {
    setError("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        title,
        slug,
        excerpt: excerpt || undefined,
        content,
        coverImageUrl: coverImageUrl || undefined,
        status,
      };

      const url =
        mode === "create"
          ? "/api/v1/blog"
          : `/api/v1/blog/${initialData?.slug}`;

      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to save post");
        return;
      }

      router.push("/admin/blog");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Title + Slug */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            placeholder="post-slug"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 font-mono text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
      </div>

      {/* Excerpt + Cover */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            placeholder="Brief description for listings and SEO"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Cover Image URL
          </label>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
      </div>

      {/* Status + Save */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Status
          </label>
          <button
            type="button"
            onClick={() => setStatus(status === "draft" ? "published" : "draft")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              status === "published" ? "bg-[#F97316]" : "bg-[var(--landing-border)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "published" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-xs text-[var(--landing-text-secondary)]">
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>

        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving || !title || !content}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "create" ? "Create Post" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className="grid min-h-[500px] gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="flex flex-col">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Content (Markdown)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post in markdown…"
            className="flex-1 resize-none rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 font-mono text-sm leading-relaxed text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Preview
          </label>
          <div className="flex-1 overflow-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 py-4">
            {content ? (
              <div className="blog-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-[var(--landing-text-tertiary)]">
                Preview will appear here…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
