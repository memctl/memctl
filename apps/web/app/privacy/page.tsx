import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/landing/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | memctl",
  description:
    "Privacy Policy for memctl, operated by Mindroot Ltd. UK GDPR and Data Protection Act 2018 compliant.",
  openGraph: {
    title: "Privacy Policy | memctl",
    description:
      "Privacy Policy for memctl, operated by Mindroot Ltd. UK GDPR and Data Protection Act 2018 compliant.",
    type: "website",
    url: "https://memctl.com/privacy",
  },
  alternates: {
    canonical: "https://memctl.com/privacy",
  },
};

const SECTIONS = [
  { id: "controller", label: "Data Controller", number: "01" },
  { id: "data-collected", label: "Data We Collect", number: "02" },
  { id: "lawful-basis", label: "Lawful Basis", number: "03" },
  { id: "how-we-use", label: "How We Use Your Data", number: "04" },
  { id: "third-parties", label: "Third-Party Processors", number: "05" },
  { id: "retention", label: "Data Retention", number: "06" },
  { id: "international", label: "International Transfers", number: "07" },
  { id: "your-rights", label: "Your Rights", number: "08" },
  { id: "exercising-rights", label: "Exercising Your Rights", number: "09" },
  { id: "children", label: "Children\u2019s Data", number: "10" },
  { id: "cookies", label: "Cookies", number: "11" },
  { id: "changes", label: "Changes to This Policy", number: "12" },
  { id: "contact", label: "Contact & Complaints", number: "13" },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="17 February 2026"
      sections={SECTIONS}
    >
      <LegalSection id="controller" number="01" title="Data Controller">
        <p>
          The data controller for the personal data processed through the memctl
          platform is:
        </p>
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <p className="font-medium text-[var(--landing-text)]">Mindroot Ltd</p>
          <p>71-75 Shelton Street, London, England, WC2H 9JQ</p>
          <p>Company No. 16543299 (England and Wales)</p>
          <p>ICO Registration: ZB958997</p>
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

      <LegalSection id="data-collected" number="02" title="Data We Collect">
        <p>We collect and process the following categories of personal data:</p>
        <p>
          <strong>Account information.</strong> When you sign up via GitHub
          OAuth, we receive your GitHub username, display name, email address,
          and profile avatar URL.
        </p>
        <p>
          <strong>User-generated content.</strong> Memories, project data,
          configurations, and other content you create or upload through the
          Service.
        </p>
        <p>
          <strong>Billing information.</strong> If you subscribe to a paid plan,
          Stripe (our payment processor) collects and processes your payment
          details. We receive your subscription status, plan type, and billing
          history but do not store your full payment card details.
        </p>
        <p>
          <strong>Usage data.</strong> We collect technical data necessary for
          operating the Service, including API request logs, feature usage
          metrics, error reports, and IP addresses.
        </p>
        <p>
          <strong>Communications.</strong> If you contact us via email, we
          retain the content of those communications.
        </p>
      </LegalSection>

      <LegalSection
        id="lawful-basis"
        number="03"
        title="Lawful Basis for Processing"
      >
        <p>
          We process your personal data under the following lawful bases as
          defined by the UK General Data Protection Regulation (UK GDPR):
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Contract performance (Article 6(1)(b)).</strong> Processing
            necessary to provide you with the Service, manage your account, and
            fulfil our contractual obligations under the Terms of Service.
          </li>
          <li>
            <strong>Legitimate interests (Article 6(1)(f)).</strong> Processing
            necessary for our legitimate interests, including improving the
            Service, ensuring security, preventing fraud, and communicating
            service-related updates. We balance these interests against your
            rights and freedoms.
          </li>
          <li>
            <strong>Legal obligation (Article 6(1)(c)).</strong> Processing
            necessary to comply with legal obligations, such as tax and
            accounting requirements.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" number="04" title="How We Use Your Data">
        <p>We use your personal data to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide, operate, and maintain the Service.</li>
          <li>Authenticate your identity and manage your account.</li>
          <li>Process payments and manage subscriptions.</li>
          <li>
            Send you service-related communications (e.g., account
            notifications, security alerts, billing updates).
          </li>
          <li>
            Monitor and improve the performance, security, and reliability of
            the Service.
          </li>
          <li>Investigate and prevent fraudulent or unauthorised activity.</li>
          <li>Comply with applicable legal obligations.</li>
        </ul>
        <p>
          We do not sell your personal data. We do not use your data for
          automated decision-making or profiling that produces legal effects.
        </p>
      </LegalSection>

      <LegalSection
        id="third-parties"
        number="05"
        title="Third-Party Processors"
      >
        <p>
          We share personal data with the following categories of third-party
          processors, each of which processes data on our behalf under
          appropriate data processing agreements:
        </p>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
            <p className="font-medium text-[var(--landing-text)]">Stripe</p>
            <p>
              Payment processing. Stripe handles all payment card data and
              billing transactions. See{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F97316] hover:underline"
              >
                Stripe&rsquo;s Privacy Policy
              </a>
              .
            </p>
          </div>
          <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
            <p className="font-medium text-[var(--landing-text)]">GitHub</p>
            <p>
              Authentication via OAuth. GitHub provides your profile information
              during sign-in. See{" "}
              <a
                href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F97316] hover:underline"
              >
                GitHub&rsquo;s Privacy Statement
              </a>
              .
            </p>
          </div>
          <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4">
            <p className="font-medium text-[var(--landing-text)]">
              Infrastructure providers
            </p>
            <p>
              Cloud hosting and database services used to store and process
              data. All infrastructure providers are selected for their strong
              security practices and compliance posture.
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection id="retention" number="06" title="Data Retention">
        <p>We retain your personal data for as long as necessary to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account data.</strong> Retained for the duration of your
            account. Deleted within 30 days of account closure.
          </li>
          <li>
            <strong>User-generated content.</strong> Retained for the duration
            of your account. Deleted within 30 days of account closure or upon
            your request.
          </li>
          <li>
            <strong>Billing records.</strong> Retained for 7 years after the end
            of the financial year in which the transaction occurred, as required
            by UK tax legislation.
          </li>
          <li>
            <strong>Usage logs.</strong> Retained for up to 90 days for
            operational and security purposes, then anonymised or deleted.
          </li>
          <li>
            <strong>Communications.</strong> Retained for up to 2 years, or
            longer where necessary for legal purposes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="international"
        number="07"
        title="International Data Transfers"
      >
        <p>
          Your data may be processed in countries outside the United Kingdom.
          Where we transfer personal data internationally, we ensure appropriate
          safeguards are in place, including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Transfers to countries that the UK Secretary of State has determined
            provide an adequate level of data protection.
          </li>
          <li>
            Standard contractual clauses approved by the UK Information
            Commissioner&rsquo;s Office (ICO).
          </li>
          <li>Other lawful transfer mechanisms as permitted under UK GDPR.</li>
        </ul>
      </LegalSection>

      <LegalSection id="your-rights" number="08" title="Your Rights">
        <p>
          Under UK GDPR and the Data Protection Act 2018, you have the following
          rights regarding your personal data:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Right of access.</strong> Request a copy of the personal
            data we hold about you.
          </li>
          <li>
            <strong>Right to rectification.</strong> Request correction of
            inaccurate or incomplete personal data.
          </li>
          <li>
            <strong>Right to erasure.</strong> Request deletion of your personal
            data, subject to legal retention requirements.
          </li>
          <li>
            <strong>Right to restriction.</strong> Request that we restrict
            processing of your personal data in certain circumstances.
          </li>
          <li>
            <strong>Right to data portability.</strong> Receive your personal
            data in a structured, commonly used, machine-readable format.
          </li>
          <li>
            <strong>Right to object.</strong> Object to processing based on
            legitimate interests or for direct marketing purposes.
          </li>
          <li>
            <strong>Right to withdraw consent.</strong> Where processing is
            based on consent, withdraw that consent at any time (without
            affecting the lawfulness of processing before withdrawal).
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="exercising-rights"
        number="09"
        title="Exercising Your Rights"
      >
        <p>
          To exercise any of your rights, please contact us at{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          . We will respond to your request within one month. In complex cases,
          we may extend this period by up to two additional months, and we will
          inform you if this is necessary.
        </p>
        <p>
          We may ask you to verify your identity before processing your request.
          There is no fee for exercising your rights, unless your request is
          manifestly unfounded or excessive.
        </p>
      </LegalSection>

      <LegalSection id="children" number="10" title="Children&rsquo;s Data">
        <p>
          The Service is not intended for use by individuals under the age of
          16. We do not knowingly collect personal data from children under 16.
          If we become aware that we have collected personal data from a child
          under 16, we will take steps to delete that data promptly.
        </p>
        <p>
          If you believe we have inadvertently collected data from a child under
          16, please contact us at{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="cookies" number="11" title="Cookies">
        <p>
          We use only essential cookies that are strictly necessary for the
          operation of the Service. Specifically, we use a single session cookie
          for authentication purposes. This cookie:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Is required for the Service to function (maintains your logged-in
            session).
          </li>
          <li>
            Is classified as a &ldquo;strictly necessary&rdquo; cookie under the
            Privacy and Electronic Communications Regulations 2003 (PECR).
          </li>
          <li>Does not require consent under PECR.</li>
          <li>Is not used for tracking, analytics, or advertising.</li>
        </ul>
        <p>
          We do not use any third-party tracking cookies, analytics cookies, or
          advertising cookies. No cookie consent banner is required because we
          only use strictly necessary cookies.
        </p>
      </LegalSection>

      <LegalSection id="changes" number="12" title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the updated policy on the Service
          and updating the &ldquo;Last updated&rdquo; date. For significant
          changes that affect how we process your personal data, we will provide
          additional notice (such as an email notification).
        </p>
        <p>We encourage you to review this Privacy Policy periodically.</p>
      </LegalSection>

      <LegalSection id="contact" number="13" title="Contact & Complaints">
        <p>
          If you have questions about this Privacy Policy or wish to exercise
          your data protection rights, please contact us:
        </p>
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <p className="font-medium text-[var(--landing-text)]">Mindroot Ltd</p>
          <p>71-75 Shelton Street, London, England, WC2H 9JQ</p>
          <p>Company No. 16543299 (England and Wales)</p>
          <p>ICO Registration: ZB958997</p>
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
        <p className="mt-4">
          <strong>Right to complain.</strong> If you are not satisfied with our
          response, you have the right to lodge a complaint with the UK
          Information Commissioner&rsquo;s Office (ICO):
        </p>
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <p className="font-medium text-[var(--landing-text)]">
            Information Commissioner&rsquo;s Office
          </p>
          <p>Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</p>
          <p>
            Website:{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F97316] hover:underline"
            >
              ico.org.uk
            </a>
          </p>
          <p>Helpline: 0303 123 1113</p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
