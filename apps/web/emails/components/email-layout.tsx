import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://memctl.com";

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        {/* Top accent bar */}
        <Section style={accentBar} />

        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: "0 auto" }}>
              <tr>
                <td style={{ paddingRight: "8px", verticalAlign: "middle" }}>
                  <div style={logoMark}>
                    <span style={{ color: "#FFFFFF", fontSize: "16px", lineHeight: "1" }}>&#9656;</span>
                  </div>
                </td>
                <td style={{ verticalAlign: "middle" }}>
                  <Text style={logoText}>memctl</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={divider} />
            <Text style={footerLinks}>
              <Link href={`${APP_URL}/privacy`} style={footerLink}>
                Privacy
              </Link>
              <span style={{ color: "#333333", padding: "0 8px" }}>/</span>
              <Link href={`${APP_URL}/terms`} style={footerLink}>
                Terms
              </Link>
              <span style={{ color: "#333333", padding: "0 8px" }}>/</span>
              <Link href={`${APP_URL}/docs`} style={footerLink}>
                Docs
              </Link>
            </Text>
            <Text style={footerCompany}>
              Mindroot Ltd, Company No. 16543299
              <br />
              71-75 Shelton Street, London, WC2H 9JQ
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#050505",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const accentBar: React.CSSProperties = {
  height: "3px",
  background: "linear-gradient(90deg, #F97316 0%, #F97316 40%, transparent 100%)",
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "48px 24px 40px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "40px",
};

const logoMark: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  backgroundColor: "#F97316",
  display: "inline-flex",
  textAlign: "center" as const,
  lineHeight: "28px",
};

const logoText: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#E5E5E5",
  letterSpacing: "-0.03em",
  margin: "0",
};

const content: React.CSSProperties = {
  padding: "0",
};

const footer: React.CSSProperties = {
  paddingTop: "24px",
};

const divider: React.CSSProperties = {
  borderColor: "#1A1A1A",
  borderTopWidth: "1px",
  margin: "0 0 24px",
};

const footerLinks: React.CSSProperties = {
  textAlign: "center" as const,
  fontSize: "12px",
  color: "#555555",
  margin: "0 0 16px",
};

const footerLink: React.CSSProperties = {
  color: "#555555",
  textDecoration: "none",
};

const footerCompany: React.CSSProperties = {
  textAlign: "center" as const,
  fontSize: "11px",
  color: "#333333",
  lineHeight: "18px",
  margin: "0",
};
