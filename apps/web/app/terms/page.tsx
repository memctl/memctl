import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/landing/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service | memctl",
  description:
    "Terms of Service for memctl, operated by Mindroot Ltd. Governs your use of the memctl platform and services.",
  openGraph: {
    title: "Terms of Service | memctl",
    description:
      "Terms of Service for memctl, operated by Mindroot Ltd. Governs your use of the memctl platform and services.",
    type: "website",
    url: "https://memctl.com/terms",
  },
  alternates: {
    canonical: "https://memctl.com/terms",
  },
};

const SECTIONS = [
  { id: "introduction", label: "Introduction", number: "01" },
  { id: "definitions", label: "Definitions", number: "02" },
  { id: "account", label: "Account Registration", number: "03" },
  { id: "subscriptions", label: "Subscriptions & Billing", number: "04" },
  { id: "acceptable-use", label: "Acceptable Use", number: "05" },
  { id: "intellectual-property", label: "Intellectual Property", number: "06" },
  { id: "your-data", label: "Your Data", number: "07" },
  { id: "availability", label: "Service Availability", number: "08" },
  { id: "liability", label: "Limitation of Liability", number: "09" },
  { id: "termination", label: "Termination", number: "10" },
  { id: "governing-law", label: "Governing Law", number: "11" },
  { id: "changes", label: "Changes to Terms", number: "12" },
  { id: "contact", label: "Contact", number: "13" },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="17 February 2026"
      sections={SECTIONS}
    >
      <LegalSection id="introduction" number="01" title="Introduction">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of the memctl platform, website, APIs, and related services
          (collectively, the &ldquo;Service&rdquo;) provided by Mindroot Ltd, a
          company registered in England and Wales (Company No. 16543299) with
          its registered office at 71-75 Shelton Street, London, England, WC2H
          9JQ (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;the
          Company&rdquo;).
        </p>
        <p>
          By accessing or using the Service, you agree to be bound by these
          Terms. If you are using the Service on behalf of an organisation, you
          represent that you have authority to bind that organisation to these
          Terms.
        </p>
        <p>
          If you do not agree to these Terms, you must not access or use the
          Service.
        </p>
      </LegalSection>

      <LegalSection id="definitions" number="02" title="Definitions">
        <p>In these Terms:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>&ldquo;Service&rdquo;</strong> means the memctl platform,
            including the web application, CLI, MCP server, APIs, SDKs, and any
            related documentation.
          </li>
          <li>
            <strong>&ldquo;User&rdquo;</strong> or{" "}
            <strong>&ldquo;you&rdquo;</strong> means any individual or entity
            that accesses or uses the Service.
          </li>
          <li>
            <strong>&ldquo;Content&rdquo;</strong> means any data, text,
            memories, configurations, or other materials you submit to the
            Service.
          </li>
          <li>
            <strong>&ldquo;Subscription&rdquo;</strong> means a paid plan that
            provides access to additional features and higher usage limits.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="account" number="03" title="Account Registration">
        <p>
          To use the Service, you must create an account by authenticating
          through GitHub OAuth. By creating an account, you agree to:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Provide accurate and complete information during the registration
            process.
          </li>
          <li>
            Maintain the security of your account credentials and GitHub
            account.
          </li>
          <li>
            Accept responsibility for all activities that occur under your
            account.
          </li>
          <li>
            Notify us immediately of any unauthorised use of your account.
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these Terms or that we reasonably believe have been compromised.
        </p>
      </LegalSection>

      <LegalSection
        id="subscriptions"
        number="04"
        title="Subscriptions & Billing"
      >
        <p>
          The Service offers both free and paid subscription plans. Paid
          subscriptions are billed through Stripe, our third-party payment
          processor.
        </p>
        <p>
          <strong>Billing.</strong> Subscription fees are charged in advance on
          a monthly or annual basis, depending on the plan you select. All
          prices are in US Dollars unless otherwise stated. Prices are exclusive
          of VAT or other applicable taxes, which will be added where required.
        </p>
        <p>
          <strong>Cancellation.</strong> You may cancel your subscription at any
          time through your account settings. Cancellation takes effect at the
          end of the current billing period. No refunds are provided for partial
          billing periods.
        </p>
        <p>
          <strong>Changes to pricing.</strong> We may change subscription prices
          with at least 30 days&rsquo; prior notice. Continued use of the
          Service after a price change constitutes acceptance of the new
          pricing.
        </p>
        <p>
          <strong>Additional seats.</strong> Some plans include a set number of
          team seats. Additional seats may be purchased at the per-seat rate
          specified on our pricing page.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" number="05" title="Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Violate any applicable law, regulation, or third-party rights.
          </li>
          <li>
            Upload or transmit any malicious code, viruses, or harmful content.
          </li>
          <li>
            Attempt to gain unauthorised access to the Service, other accounts,
            or related systems.
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the
            Service.
          </li>
          <li>
            Use the Service for any unlawful, fraudulent, or abusive purpose.
          </li>
          <li>
            Resell, sublicense, or redistribute the Service without our prior
            written consent.
          </li>
          <li>
            Scrape, crawl, or use automated means to access the Service in a
            manner that exceeds reasonable use.
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate your access if we
          reasonably determine that you have violated this acceptable use
          policy.
        </p>
      </LegalSection>

      <LegalSection
        id="intellectual-property"
        number="06"
        title="Intellectual Property"
      >
        <p>
          <strong>Our IP.</strong> The Service, including its design, code,
          documentation, and branding, is owned by Mindroot Ltd and is protected
          by intellectual property laws. These Terms do not grant you any right,
          title, or interest in the Service beyond the limited right to use it
          in accordance with these Terms.
        </p>
        <p>
          <strong>Open source.</strong> Certain components of the Service
          (including the MCP server, CLI, and SDKs) are made available under the
          Apache-2.0 licence. Your use of those components is governed by the
          applicable open-source licence.
        </p>
      </LegalSection>

      <LegalSection id="your-data" number="07" title="Your Data">
        <p>
          <strong>Ownership.</strong> You retain all rights, title, and interest
          in the Content you submit to the Service, including your memories,
          project data, and configurations. We do not claim ownership of your
          Content.
        </p>
        <p>
          <strong>Licence.</strong> By submitting Content to the Service, you
          grant us a limited, non-exclusive licence to store, process, and
          display your Content solely as necessary to provide and improve the
          Service.
        </p>
        <p>
          <strong>Data portability.</strong> You may export your Content at any
          time using the Service&rsquo;s export features or API.
        </p>
        <p>
          <strong>Deletion.</strong> Upon termination of your account, we will
          delete your Content within 30 days, except where we are required by
          law to retain it.
        </p>
      </LegalSection>

      <LegalSection id="availability" number="08" title="Service Availability">
        <p>
          We strive to maintain high availability of the Service but do not
          guarantee uninterrupted or error-free operation. The Service is
          provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
          basis.
        </p>
        <p>
          We may perform scheduled maintenance, which we will endeavour to
          communicate in advance. We are not liable for any downtime, data loss,
          or service interruptions.
        </p>
        <p>
          To the fullest extent permitted by law, we disclaim all warranties,
          whether express, implied, or statutory, including but not limited to
          implied warranties of merchantability, fitness for a particular
          purpose, and non-infringement.
        </p>
      </LegalSection>

      <LegalSection id="liability" number="09" title="Limitation of Liability">
        <p>
          Nothing in these Terms excludes or limits our liability for: (a) death
          or personal injury caused by our negligence; (b) fraud or fraudulent
          misrepresentation; or (c) any other liability that cannot be excluded
          or limited under the laws of England and Wales.
        </p>
        <p>Subject to the above, to the maximum extent permitted by law:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            We shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits, revenue,
            data, or business opportunities.
          </li>
          <li>
            Our total aggregate liability arising out of or in connection with
            these Terms or the Service shall not exceed the greater of (a) the
            total fees paid by you in the 12 months preceding the claim, or (b)
            &pound;100.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" number="10" title="Termination">
        <p>
          <strong>By you.</strong> You may terminate your account at any time by
          deleting it through your account settings or by contacting us at{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          .
        </p>
        <p>
          <strong>By us.</strong> We may suspend or terminate your access to the
          Service at any time, with or without cause, with or without notice. We
          will endeavour to provide reasonable notice where practicable.
        </p>
        <p>
          Upon termination, your right to use the Service ceases immediately.
          Sections relating to intellectual property, limitation of liability,
          governing law, and any other provisions that by their nature should
          survive, will survive termination.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" number="11" title="Governing Law">
        <p>
          These Terms are governed by and construed in accordance with the laws
          of England and Wales. Any disputes arising out of or in connection
          with these Terms shall be subject to the exclusive jurisdiction of the
          courts of England and Wales.
        </p>
      </LegalSection>

      <LegalSection id="changes" number="12" title="Changes to Terms">
        <p>
          We may update these Terms from time to time. We will notify you of
          material changes by posting the updated Terms on the Service and
          updating the &ldquo;Last updated&rdquo; date. Your continued use of
          the Service after changes are posted constitutes acceptance of the
          revised Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" number="13" title="Contact">
        <p>If you have any questions about these Terms, please contact us:</p>
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <p className="font-medium text-[var(--landing-text)]">Mindroot Ltd</p>
          <p>71-75 Shelton Street, London, England, WC2H 9JQ</p>
          <p>Company No. 16543299</p>
          <p>
            Email:{" "}
            <a
              href="mailto:team@memctl.com"
              className="text-[#F97316] hover:underline"
            >
              team@memctl.com
            </a>
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
