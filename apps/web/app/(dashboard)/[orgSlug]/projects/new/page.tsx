"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function NewProjectPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCreate = async () => {
    if (!name || !slug) {
      setError("Name and slug are required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/projects?org=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setSaving(false);
        return;
      }

      router.push(`/${orgSlug}/projects/${slug}`);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-6 font-mono text-2xl font-bold">New Project</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create a project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Project Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
              placeholder="My App"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="my-app"
            />
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Used in MCP config as MEMCTL_PROJECT
            </p>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleCreate} disabled={saving || !name || !slug}>
            {saving ? "Creating..." : "Create Project"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
