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
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>
              <span style={{ color: "#F97316" }}>&#9656;</span> memctl
            </Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={divider} />
            <Text style={footerLinks}>
              <Link href={`${APP_URL}/privacy`} style={footerLink}>
                Privacy Policy
              </Link>
              {" \u00B7 "}
              <Link href={`${APP_URL}/terms`} style={footerLink}>
                Terms of Service
              </Link>
            </Text>
            <Text style={footerCompany}>
              Mindroot Ltd, Company No. 16543299
              <br />
              71-75 Shelton Street, London, WC2H 9JQ
              <br />
              ICO Reg ZB958997
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#0A0A0A",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "32px",
};

const logo: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#F5F5F5",
  letterSpacing: "-0.02em",
  margin: "0",
};

const content: React.CSSProperties = {
  padding: "0",
};

const footer: React.CSSProperties = {
  paddingTop: "16px",
};

const divider: React.CSSProperties = {
  borderColor: "#1E1E1E",
  borderTopWidth: "1px",
  margin: "0 0 24px",
};

const footerLinks: React.CSSProperties = {
  textAlign: "center" as const,
  fontSize: "12px",
  color: "#666666",
  margin: "0 0 12px",
};

const footerLink: React.CSSProperties = {
  color: "#666666",
  textDecoration: "underline",
};

const footerCompany: React.CSSProperties = {
  textAlign: "center" as const,
  fontSize: "11px",
  color: "#444444",
  lineHeight: "18px",
  margin: "0",
};
