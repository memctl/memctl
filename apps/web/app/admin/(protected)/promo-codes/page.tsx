import { db } from "@/lib/db";
import { promoCodes, promoRedemptions, organizations } from "@memctl/db/schema";
import { count, sum, eq } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { PromoCodesManager } from "@/components/admin/promo-codes-manager";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const [
    totalCodes,
    activeCodes,
    totalRedemptions,
    totalDiscountResult,
    orgList,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(promoCodes)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(promoCodes)
      .where(eq(promoCodes.active, true))
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(promoRedemptions)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: sum(promoCodes.totalDiscountGiven) })
      .from(promoCodes)
      .then((r) => Number(r[0]?.value ?? 0)),
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations),
  ]);

  return (
    <div>
      <PageHeader
        badge="Admin"
        title="Promo Codes"
        description="Manage promotional codes and discounts"
      />
      <PromoCodesManager
        stats={{
          totalCodes,
          activeCodes,
          totalRedemptions,
          totalDiscountGiven: totalDiscountResult,
        }}
        orgList={orgList}
      />
    </div>
  );
}
