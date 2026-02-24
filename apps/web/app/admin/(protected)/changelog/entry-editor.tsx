"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

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

const selectPopoverCls =
  "bg-[var(--landing-surface)] border-[var(--landing-border)] text-[var(--landing-text)] shadow-xl";
const selectItemCls =
  "font-mono text-[var(--landing-text-secondary)] focus:bg-[var(--landing-surface-2)] focus:text-[var(--landing-text)]";

export function EntryEditor({ mode, initialData }: EntryEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

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
        toast.error(data.error || "Failed to save entry");
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
      {/* Version + Title */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Version
          </label>
          <Input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.2.0"
            className="font-mono"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Title
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dashboard Redesign"
          />
        </div>
      </div>

      {/* Summary + Release Date */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Summary
          </label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Short description for listing cards"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Release Date
          </label>
          <Input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
          />
        </div>
      </div>

      {/* Status + Save */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
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
            disabled={saving || !version || !title || !hasValidItems}
            className="bg-[#F97316] text-white hover:bg-[#FB923C] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            {saving
              ? "Saving..."
              : mode === "create"
                ? "Create Entry"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Changes section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
            Changes
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Change
          </Button>
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
                  <Select
                    value={item.category}
                    onValueChange={(val) => updateItem(index, "category", val)}
                  >
                    <SelectTrigger className="w-[130px] font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectPopoverCls}>
                      {categoryOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className={selectItemCls}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-[var(--landing-text-tertiary)]">
                    #{index + 1}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() =>
                        setPreviewIndex(previewIndex === index ? null : index)
                      }
                    >
                      {previewIndex === index ? "Hide Preview" : "Preview"}
                    </Button>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-[var(--landing-text-tertiary)] hover:text-red-500"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, "description", e.target.value)
                  }
                  rows={3}
                  placeholder="Describe this change in markdown..."
                  className="resize-none font-mono text-sm leading-relaxed"
                />
              </div>
            ))}
          </div>

          {/* Preview panel */}
          <div className="flex flex-col">
            <label className="mb-2 block text-xs font-medium tracking-wider text-[var(--landing-text-tertiary)] uppercase">
              Preview
            </label>
            <div className="flex-1 overflow-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 py-4">
              {previewIndex !== null && items[previewIndex]?.description ? (
                <div className="blog-prose">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSlug]}
                  >
                    {items[previewIndex].description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-[var(--landing-text-tertiary)] italic">
                  {previewIndex !== null
                    ? "Start typing to see preview..."
                    : 'Click "Preview" on a change to preview it here.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
