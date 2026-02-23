import { redirect } from "next/navigation";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = await params;
  redirect(`/org/${orgSlug}/projects/${projectSlug}?tab=settings`);
}
