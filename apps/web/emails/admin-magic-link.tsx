import {
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

interface AdminMagicLinkEmailProps {
  url: string;
  email: string;
}

export function AdminMagicLinkEmail({ url, email }: AdminMagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your admin login link for memctl">
      <Section style={card}>
        {/* Badge */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: "0 auto 24px" }}>
          <tr>
            <td style={badge}>ADMIN ACCESS</td>
          </tr>
        </table>

        <Text style={heading}>Sign in to your admin panel</Text>

        <Text style={cardText}>
          Use the link below to authenticate. For security, this link
          is single-use and expires in 5 minutes.
        </Text>

        <Section style={buttonContainer}>
          <Link href={url} style={button}>
            Sign in
          </Link>
        </Section>

        <Hr style={cardDivider} />

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={metaLabel}>Account</td>
            <td style={metaValue}>{email}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Expires</td>
            <td style={metaValue}>5 minutes</td>
          </tr>
        </table>
      </Section>

      <Text style={fallback}>
        If the button doesn&apos;t work, copy this URL into your browser:
      </Text>
      <Text style={urlText}>{url}</Text>
    </EmailLayout>
  );
}

export default AdminMagicLinkEmail;

const card: React.CSSProperties = {
  backgroundColor: "#0D0D0D",
  borderRadius: "12px",
  border: "1px solid #1A1A1A",
  padding: "36px 32px",
  marginBottom: "24px",
};

const badge: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#F97316",
  backgroundColor: "rgba(249, 115, 22, 0.08)",
  border: "1px solid rgba(249, 115, 22, 0.15)",
  borderRadius: "100px",
  padding: "4px 14px",
  display: "inline-block",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#E5E5E5",
  textAlign: "center" as const,
  margin: "0 0 12px",
  letterSpacing: "-0.02em",
};

const cardText: React.CSSProperties = {
  fontSize: "14px",
  color: "#888888",
  lineHeight: "22px",
  margin: "0 0 28px",
  textAlign: "center" as const,
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "28px",
};

const button: React.CSSProperties = {
  backgroundColor: "#F97316",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  borderRadius: "8px",
  padding: "12px 40px",
  display: "inline-block",
};

const cardDivider: React.CSSProperties = {
  borderColor: "#1A1A1A",
  borderTopWidth: "1px",
  margin: "0 0 16px",
};

const metaLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#555555",
  padding: "4px 0",
  width: "70px",
  verticalAlign: "top" as const,
};

const metaValue: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  padding: "4px 0",
  verticalAlign: "top" as const,
};

const fallback: React.CSSProperties = {
  fontSize: "12px",
  color: "#444444",
  margin: "0 0 4px",
};

const urlText: React.CSSProperties = {
  fontSize: "11px",
  color: "#333333",
  wordBreak: "break-all" as const,
  margin: "0",
};
