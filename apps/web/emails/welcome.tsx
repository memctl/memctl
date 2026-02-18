import {
  Section,
  Text,
  Link,
} from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://memctl.com";

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to memctl - persistent memory for your AI coding agents">
      <Text style={heading}>Welcome to memctl</Text>

      <Section style={card}>
        <Text style={greeting}>Hey {name},</Text>

        <Text style={cardText}>
          memctl gives your AI coding agents persistent memory. Store
          architectural decisions, coding standards, and project context so your
          agents stay aligned across every session.
        </Text>

        <Section style={buttonContainer}>
          <Link href={`${APP_URL}/docs`} style={button}>
            Read the quickstart guide
          </Link>
        </Section>
      </Section>

      <Text style={sub}>
        If you have any questions, reply to this email or check out our{" "}
        <Link href={`${APP_URL}/docs`} style={link}>
          documentation
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;

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

const greeting: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#F5F5F5",
  margin: "0 0 16px",
};

const cardText: React.CSSProperties = {
  fontSize: "14px",
  color: "#A1A1A1",
  lineHeight: "24px",
  margin: "0 0 24px",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
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

const sub: React.CSSProperties = {
  fontSize: "13px",
  color: "#666666",
  lineHeight: "22px",
  margin: "0",
};

const link: React.CSSProperties = {
  color: "#F97316",
  textDecoration: "underline",
};
