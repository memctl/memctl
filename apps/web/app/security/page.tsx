import type { Metadata } from "next";
import {
  LegalLayout,
  LegalSection,
} from "@/components/landing/legal-layout";

export const metadata: Metadata = {
  title: "Security | memctl",
  description:
    "Learn about memctl security practices, encryption, infrastructure security, SOC 2 compliance, and responsible disclosure. Operated by Mindroot Ltd.",
  openGraph: {
    title: "Security | memctl",
    description:
      "Learn about memctl security practices, encryption, infrastructure security, SOC 2 compliance, and responsible disclosure.",
    type: "website",
    url: "https://memctl.com/security",
  },
  alternates: {
    canonical: "https://memctl.com/security",
  },
};

const SECTIONS = [
  { id: "overview", label: "Overview", number: "01" },
  { id: "encryption", label: "Encryption", number: "02" },
  { id: "authentication", label: "Authentication & Access", number: "03" },
  { id: "infrastructure", label: "Infrastructure", number: "04" },
  { id: "soc2", label: "SOC 2 Compliance", number: "05" },
  { id: "data-handling", label: "Data Handling", number: "06" },
  { id: "incident-response", label: "Incident Response", number: "07" },
  { id: "disclosure", label: "Responsible Disclosure", number: "08" },
  { id: "compliance", label: "Compliance", number: "09" },
];

export default function SecurityPage() {
  return (
    <LegalLayout
      title="Security"
      lastUpdated="17 February 2026"
      sections={SECTIONS}
    >
      <LegalSection id="overview" number="01" title="Security Overview">
        <p>
          Security is foundational to everything we build at memctl. As a
          platform that stores and serves context for AI coding agents, we
          understand the sensitivity of the data entrusted to us. We implement
          multiple layers of protection across our infrastructure, application,
          and operational processes.
        </p>
        <p>
          This page describes our security practices and the measures we take to
          protect your data. If you have security concerns or questions, please
          contact us at{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="encryption" number="02" title="Encryption">
        <p>
          <strong>In transit.</strong> All data transmitted between your devices
          and our servers is encrypted using TLS 1.2 or higher. We enforce HTTPS
          on all endpoints and use HSTS headers to prevent downgrade attacks.
        </p>
        <p>
          <strong>At rest.</strong> All data stored in our databases and object
          storage is encrypted at rest using AES 256 encryption. Encryption keys
          are managed through our cloud provider&rsquo;s key management service
          with automatic key rotation.
        </p>
        <p>
          <strong>Backups.</strong> All backups are encrypted using the same
          standards as primary data storage.
        </p>
      </LegalSection>

      <LegalSection
        id="authentication"
        number="03"
        title="Authentication and Access Controls"
      >
        <p>
          <strong>User authentication.</strong> We use GitHub OAuth for user
          authentication, leveraging GitHub&rsquo;s robust identity
          infrastructure. We do not store passwords.
        </p>
        <p>
          <strong>Session management.</strong> Sessions are managed through
          secure, HTTP only cookies with appropriate expiration policies. Session
          tokens are cryptographically random and rotated regularly.
        </p>
        <p>
          <strong>API access.</strong> API keys are generated with sufficient
          entropy and can be revoked at any time through your account settings.
          API requests are authenticated and rate limited.
        </p>
        <p>
          <strong>Internal access.</strong> Employee access to production systems
          follows the principle of least privilege. All access is logged and
          reviewed. Multi factor authentication is required for all internal
          systems.
        </p>
      </LegalSection>

      <LegalSection id="infrastructure" number="04" title="Infrastructure Security">
        <p>
          Our infrastructure is hosted on industry leading cloud platforms with
          strong physical and network security controls, including:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Network isolation with private subnets, security groups, and
            firewalls.
          </li>
          <li>
            DDoS protection and web application firewalls on all public
            endpoints.
          </li>
          <li>
            Regular vulnerability scanning and penetration testing.
          </li>
          <li>
            Automated patching and updates for operating systems and
            dependencies.
          </li>
          <li>
            Container based deployment with minimal attack surface and no SSH
            access to production.
          </li>
          <li>
            Infrastructure as code with version control and peer review for all
            changes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="soc2" number="05" title="SOC 2 Compliance">
        <p>
          We are actively working towards SOC 2 Type II certification. Our
          compliance programme covers the Trust Services Criteria for Security,
          Availability, and Confidentiality.
        </p>
        <p>Current status of our SOC 2 journey:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Policies and procedures.</strong> Comprehensive information
            security policies have been established covering access control,
            incident response, change management, risk assessment, and vendor
            management.
          </li>
          <li>
            <strong>Technical controls.</strong> Monitoring, logging, alerting,
            encryption, and access controls are implemented in accordance with
            SOC 2 requirements.
          </li>
          <li>
            <strong>Audit readiness.</strong> We are in the process of engaging
            an independent auditor. We will publish our SOC 2 Type II report
            upon completion.
          </li>
        </ul>
        <p>
          If you require our SOC 2 readiness documentation for your vendor
          assessment, please contact{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="data-handling" number="06" title="Data Handling and Isolation">
        <p>
          <strong>Tenant isolation.</strong> Each organisation&rsquo;s data is
          logically isolated. Access controls ensure that users can only access
          data belonging to their own projects and teams.
        </p>
        <p>
          <strong>Data minimisation.</strong> We collect and retain only the data
          necessary to provide the Service. We do not sell, share, or use
          customer data for advertising or training models.
        </p>
        <p>
          <strong>Secure deletion.</strong> When you delete data or close your
          account, we ensure it is permanently removed from our production
          systems within 30 days and from backups within 90 days.
        </p>
      </LegalSection>

      <LegalSection id="incident-response" number="07" title="Incident Response">
        <p>
          We maintain a documented incident response plan that covers detection,
          containment, investigation, remediation, and communication. Our
          incident response process includes:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            24/7 monitoring and automated alerting for suspicious activity.
          </li>
          <li>
            Defined escalation procedures and an on call rotation.
          </li>
          <li>
            Post incident reviews with root cause analysis for all security
            events.
          </li>
          <li>
            Notification of affected users within 72 hours of a confirmed
            personal data breach, as required by UK GDPR.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="disclosure" number="08" title="Responsible Disclosure">
        <p>
          We welcome reports from security researchers who discover
          vulnerabilities in our Service. If you believe you have found a
          security issue, please report it responsibly:
        </p>
        <div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
          <p className="font-medium text-[var(--landing-text)]">
            Security Contact
          </p>
          <p>
            Email:{" "}
            <a
              href="mailto:team@memctl.com"
              className="text-[#F97316] hover:underline"
            >
              team@memctl.com
            </a>
          </p>
          <p className="mt-2">
            Please include a detailed description of the vulnerability,
            steps to reproduce, and any relevant proof of concept.
          </p>
        </div>
        <p>We ask that you:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Give us reasonable time to investigate and address the issue before
            public disclosure.
          </li>
          <li>
            Do not access, modify, or delete data belonging to other users.
          </li>
          <li>
            Act in good faith and avoid actions that could harm the Service or
            its users.
          </li>
        </ul>
        <p>
          We will acknowledge your report within 48 hours and work with you to
          understand and resolve the issue. We will not pursue legal action
          against researchers who follow this responsible disclosure process.
        </p>
      </LegalSection>

      <LegalSection id="compliance" number="09" title="Compliance">
        <p>
          We maintain compliance with the following standards and regulations:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>UK GDPR and Data Protection Act 2018.</strong> We are
            registered with the Information Commissioner&rsquo;s Office (ICO
            Registration: ZB958997) and comply with all applicable UK data
            protection legislation.
          </li>
          <li>
            <strong>SOC 2.</strong> Actively working towards SOC 2 Type II
            certification (see above).
          </li>
          <li>
            <strong>PECR.</strong> We comply with the Privacy and Electronic
            Communications Regulations 2003. We use only strictly necessary
            cookies and do not engage in unsolicited marketing.
          </li>
        </ul>
        <p>
          For compliance documentation, security questionnaires, or to discuss
          your organisation&rsquo;s specific requirements, please contact{" "}
          <a
            href="mailto:team@memctl.com"
            className="text-[#F97316] hover:underline"
          >
            team@memctl.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
