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
        <Container style={outerWrap}>
          {/* Orange top rule */}
          <div style={topRule} />

          <Container style={container}>
            {/* Logo */}
            <Section style={header}>
              <Text style={logo}>
                <span style={logoChevron}>&#9656;</span> memctl
              </Text>
            </Section>

            {/* Content */}
            <Section style={content}>{children}</Section>

            {/* Footer */}
            <Section style={footer}>
              <Hr style={divider} />
              <Text style={footerNav}>
                <Link href={APP_URL} style={footerLink}>memctl.com</Link>
                {" \u00B7 "}
                <Link href={`${APP_URL}/docs`} style={footerLink}>Docs</Link>
                {" \u00B7 "}
                <Link href={`${APP_URL}/privacy`} style={footerLink}>Privacy</Link>
                {" \u00B7 "}
                <Link href={`${APP_URL}/terms`} style={footerLink}>Terms</Link>
              </Text>
              <Text style={copyright}>
                &copy; 2026 Mindroot Ltd, 71-75 Shelton Street, London WC2H 9JQ
              </Text>
            </Section>
          </Container>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#0A0A0A",
  fontFamily:
    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: "0",
  padding: "0",
};

const outerWrap: React.CSSProperties = {
  maxWidth: "100%",
  margin: "0",
  padding: "0",
};

const topRule: React.CSSProperties = {
  height: "2px",
  backgroundColor: "#F97316",
};

const container: React.CSSProperties = {
  maxWidth: "540px",
  margin: "0 auto",
  padding: "40px 24px 32px",
};

const header: React.CSSProperties = {
  paddingBottom: "32px",
};

const logo: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: "#E5E5E5",
  letterSpacing: "-0.02em",
  margin: "0",
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

const logoChevron: React.CSSProperties = {
  color: "#F97316",
};

const content: React.CSSProperties = {
  padding: "0",
};

const footer: React.CSSProperties = {
  paddingTop: "8px",
};

const divider: React.CSSProperties = {
  borderColor: "#1E1E1E",
  borderTopWidth: "1px",
  margin: "0 0 20px",
};

const footerNav: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "11px",
  color: "#525252",
  margin: "0 0 8px",
  letterSpacing: "0.01em",
};

const footerLink: React.CSSProperties = {
  color: "#525252",
  textDecoration: "none",
};

const copyright: React.CSSProperties = {
  fontSize: "11px",
  color: "#333333",
  lineHeight: "18px",
  margin: "0",
};
