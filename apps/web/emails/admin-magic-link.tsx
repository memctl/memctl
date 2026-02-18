import {
  Section,
  Text,
  Link,
} from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

interface AdminMagicLinkEmailProps {
  url: string;
  email: string;
}

export function AdminMagicLinkEmail({ url, email }: AdminMagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your admin login link for memctl">
      <Text style={heading}>Admin Login</Text>

      <Section style={card}>
        <Text style={cardText}>
          Click the button below to sign in to the memctl admin panel.
        </Text>

        <Section style={buttonContainer}>
          <Link href={url} style={button}>
            Sign in to Admin
          </Link>
        </Section>

        <Text style={meta}>
          Sent to{" "}
          <span style={{ color: "#F5F5F5" }}>{email}</span>
        </Text>
        <Text style={meta}>This link expires in 5 minutes.</Text>
      </Section>

      <Text style={fallback}>
        If the button doesn&apos;t work, copy and paste this URL into your
        browser:
      </Text>
      <Text style={urlText}>{url}</Text>
    </EmailLayout>
  );
}

export default AdminMagicLinkEmail;

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#F5F5F5",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const card: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "8px",
  border: "1px solid #1E1E1E",
  padding: "32px 24px",
  marginBottom: "24px",
};

const cardText: React.CSSProperties = {
  fontSize: "14px",
  color: "#A1A1A1",
  lineHeight: "24px",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "20px",
};

const button: React.CSSProperties = {
  backgroundColor: "#F97316",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  borderRadius: "6px",
  padding: "12px 32px",
  display: "inline-block",
};

const meta: React.CSSProperties = {
  fontSize: "12px",
  color: "#666666",
  textAlign: "center" as const,
  margin: "0",
  lineHeight: "20px",
};

const fallback: React.CSSProperties = {
  fontSize: "12px",
  color: "#666666",
  margin: "0 0 4px",
};

const urlText: React.CSSProperties = {
  fontSize: "11px",
  color: "#444444",
  wordBreak: "break-all" as const,
  margin: "0",
};
