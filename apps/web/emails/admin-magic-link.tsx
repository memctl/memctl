import { Section, Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

interface AdminMagicLinkEmailProps {
  url: string;
  email: string;
}

export function AdminMagicLinkEmail({ url, email }: AdminMagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your admin login link for memctl">
      {/* Card */}
      <Section style={card}>
        {/* Mono label */}
        <Text style={label}>ADMIN LOGIN</Text>

        <Text style={heading}>Sign in to the admin panel</Text>

        <Text style={body}>
          Click the button below to authenticate. This link is single-use and
          expires in 5 minutes.
        </Text>

        {/* CTA */}
        <Section style={btnWrap}>
          <Link href={url} style={btn}>
            Sign in &rarr;
          </Link>
        </Section>
      </Section>

      {/* Meta row */}
      <Section style={metaCard}>
        <table
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={{ width: "100%" }}
        >
          <tr>
            <td style={metaCell}>
              <Text style={metaLabel}>Account</Text>
              <Text style={metaValue}>{email}</Text>
            </td>
            <td style={metaCell}>
              <Text style={metaLabel}>Expires</Text>
              <Text style={metaValue}>5 minutes</Text>
            </td>
          </tr>
        </table>
      </Section>

      {/* Fallback */}
      <Text style={fallbackText}>
        Button not working? Copy this URL into your browser:
      </Text>
      <Text style={urlText}>{url}</Text>
    </EmailLayout>
  );
}

export default AdminMagicLinkEmail;

const card: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "8px",
  border: "1px solid #1E1E1E",
  padding: "32px 28px",
  marginBottom: "12px",
};

const label: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.12em",
  color: "#F97316",
  margin: "0 0 20px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#F5F5F5",
  letterSpacing: "-0.02em",
  margin: "0 0 12px",
  lineHeight: "1.3",
};

const body: React.CSSProperties = {
  fontSize: "14px",
  color: "#A1A1A1",
  lineHeight: "22px",
  margin: "0 0 28px",
};

const btnWrap: React.CSSProperties = {
  textAlign: "center" as const,
};

const btn: React.CSSProperties = {
  backgroundColor: "#F97316",
  color: "#FFFFFF",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  textDecoration: "none",
  borderRadius: "6px",
  padding: "10px 32px",
  display: "inline-block",
};

const metaCard: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "8px",
  border: "1px solid #1E1E1E",
  padding: "16px 20px",
  marginBottom: "24px",
};

const metaCell: React.CSSProperties = {
  width: "50%",
  verticalAlign: "top" as const,
};

const metaLabel: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "9px",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "#666666",
  margin: "0 0 4px",
};

const metaValue: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "12px",
  color: "#A1A1A1",
  margin: "0",
};

const fallbackText: React.CSSProperties = {
  fontSize: "12px",
  color: "#525252",
  margin: "0 0 6px",
};

const urlText: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "11px",
  color: "#444444",
  wordBreak: "break-all" as const,
  margin: "0",
  lineHeight: "18px",
};
