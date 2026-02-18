"use client";

import { PageHeader } from "@/components/dashboard/shared/page-header";
import { EntryEditor } from "../entry-editor";

export default function NewChangelogEntryPage() {
  return (
    <div>
      <PageHeader badge="Changelog" title="New Changelog Entry" />
      <EntryEditor mode="create" />
    </div>
  );
}
