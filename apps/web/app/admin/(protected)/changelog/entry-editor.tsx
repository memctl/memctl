"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Plus, Trash2 } from "lucide-react";

type Category = "feature" | "fix" | "improvement" | "breaking";

interface ChangeItem {
  category: Category;
  description: string;
}

interface EntryEditorProps {
  mode: "create" | "edit";
  initialData?: {
    version: string;
    title: string;
    summary: string;
    releaseDate: string;
    status: string;
    items: { category: string; description: string; sortOrder: number }[];
  };
}

const categoryOptions: { value: Category; label: string; color: string }[] = [
  { value: "feature", label: "Feature", color: "text-orange-500" },
  { value: "fix", label: "Fix", color: "text-emerald-500" },
  { value: "improvement", label: "Improvement", color: "text-blue-500" },
  { value: "breaking", label: "Breaking", color: "text-red-500" },
];

export function EntryEditor({ mode, initialData }: EntryEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(initialData?.version ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [releaseDate, setReleaseDate] = useState(
    initialData?.releaseDate ?? new Date().toISOString().split("T")[0],
  );
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [items, setItems] = useState<ChangeItem[]>(
    initialData?.items?.map((i) => ({
      category: i.category as Category,
      description: i.description,
    })) ?? [{ category: "feature", description: "" }],
  );
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function addItem() {
    setItems([...items, { category: "feature", description: "" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
    if (previewIndex === index) setPreviewIndex(null);
    else if (previewIndex !== null && previewIndex > index) {
      setPreviewIndex(previewIndex - 1);
    }
  }

  function updateItem(index: number, field: keyof ChangeItem, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    try {
      const body = {
        version,
        title,
        summary: summary || undefined,
        releaseDate,
        status,
        items: items.map((item, index) => ({
          category: item.category,
          description: item.description,
          sortOrder: index,
        })),
      };

      const url =
        mode === "create"
          ? "/api/v1/changelog"
          : `/api/v1/changelog/${initialData?.version}`;

      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to save entry");
        return;
      }

      router.push("/admin/changelog");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const hasValidItems = items.some((i) => i.description.trim().length > 0);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Version + Title */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Version
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.2.0"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 font-mono text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dashboard Redesign"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
      </div>

      {/* Summary + Release Date */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Short description for listing cards"
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Release Date
          </label>
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--landing-text)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
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
            disabled={saving || !version || !title || !hasValidItems}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "create" ? "Create Entry" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Changes section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
            Changes
          </label>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--landing-border)] px-3 py-1.5 text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:border-[#F97316] hover:text-[#F97316]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Change
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Items list */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className={`rounded-lg border bg-[var(--landing-surface)] p-4 transition-colors ${
                  previewIndex === index
                    ? "border-[#F97316]"
                    : "border-[var(--landing-border)]"
                }`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(index, "category", e.target.value)}
                    className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-1.5 text-xs font-medium text-[var(--landing-text)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--landing-text-tertiary)]">
                    #{index + 1}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                      className="text-xs font-medium text-[var(--landing-text-secondary)] transition-colors hover:text-[#F97316]"
                    >
                      {previewIndex === index ? "Hide Preview" : "Preview"}
                    </button>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-[var(--landing-text-tertiary)] transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  rows={3}
                  placeholder="Describe this change in markdown…"
                  className="w-full resize-none rounded-md border border-[var(--landing-border)] bg-[var(--landing-code-bg)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--landing-text)] placeholder:text-[var(--landing-text-tertiary)] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>
            ))}
          </div>

          {/* Preview panel */}
          <div className="flex flex-col">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--landing-text-tertiary)]">
              Preview
            </label>
            <div className="flex-1 overflow-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 py-4">
              {previewIndex !== null && items[previewIndex]?.description ? (
                <div className="blog-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                    {items[previewIndex].description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-[var(--landing-text-tertiary)]">
                  {previewIndex !== null
                    ? "Start typing to see preview…"
                    : "Click \"Preview\" on a change to preview it here."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
