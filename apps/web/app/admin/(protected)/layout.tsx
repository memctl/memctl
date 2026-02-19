import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/admin/login");
  }

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--landing-bg)] text-[var(--landing-text)]">
        <div className="text-center">
          <span className="mb-4 inline-block font-mono text-[11px] font-medium uppercase text-[#F97316]">
            403
          </span>
          <h1 className="mb-2 text-2xl font-bold">Access Denied</h1>
          <p className="text-sm text-[var(--landing-text-tertiary)]">
            You do not have admin privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--landing-bg)]">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader user={session.user} />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
