"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initialData?.slug);
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    initialData?.coverImageUrl ?? "",
  );
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
        toast.error(data.error || "Failed to save post");
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
      {/* Title + Slug */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Title
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Slug
          </label>
          <Input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            placeholder="post-slug"
            className="font-mono"
          />
        </div>
      </div>

      {/* Excerpt + Cover */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Excerpt
          </label>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            placeholder="Brief description for listings and SEO"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Cover Image URL
          </label>
          <Input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      </div>

      {/* Status + Save */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Status
          </label>
          <Switch
            checked={status === "published"}
            onCheckedChange={(checked) =>
              setStatus(checked ? "published" : "draft")
            }
            className="data-[state=checked]:bg-[#F97316]"
          />
          <span className="text-xs text-[var(--landing-text-secondary)]">
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>

        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={saving || !title || !content}
            className="bg-[#F97316] text-white hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            {saving
              ? "Saving..."
              : mode === "create"
                ? "Create Post"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className="grid min-h-[500px] gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="flex flex-col">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Content (Markdown)
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post in markdown..."
            className="flex-1 resize-none font-mono text-sm leading-relaxed"
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug]}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-[var(--landing-text-tertiary)]">
                Preview will appear here...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
