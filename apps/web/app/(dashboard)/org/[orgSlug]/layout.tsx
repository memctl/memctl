import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const { orgSlug } = await params;

  return (
    <div className="flex h-screen bg-[var(--landing-bg)]">
      <Sidebar orgSlug={orgSlug} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={session.user} orgSlug={orgSlug} />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
