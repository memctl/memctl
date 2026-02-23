import {
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://memctl.com";

interface WelcomeEmailProps {
  name: string;
}

const features = [
  {
    title: "Persistent context",
    description: "Store decisions, standards, and project context that survive across sessions.",
  },
  {
    title: "Team-wide memory",
    description: "Share knowledge across agents and team members, so everyone stays aligned.",
  },
  {
    title: "Works with any agent",
    description: "MCP server + CLI that plugs into Claude Code, Cursor, Windsurf, and more.",
  },
];

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to memctl - persistent memory for your AI coding agents">
      <Section style={card}>
        <Text style={greeting}>Hey {name},</Text>

        <Text style={intro}>
          Welcome to memctl. Your AI coding agents now have persistent memory
          that carries across every session.
        </Text>

        <Hr style={cardDivider} />

        {features.map((feature, i) => (
          <div key={feature.title} style={i < features.length - 1 ? featureRow : featureRowLast}>
            <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
              <tr>
                <td style={featureDot}>
                  <div style={dot} />
                </td>
                <td>
                  <Text style={featureTitle}>{feature.title}</Text>
                  <Text style={featureDesc}>{feature.description}</Text>
                </td>
              </tr>
            </table>
          </div>
        ))}

        <Hr style={cardDivider} />

        <Section style={buttonContainer}>
          <Link href={`${APP_URL}/docs`} style={button}>
            Get started
          </Link>
        </Section>
      </Section>

      <Text style={sub}>
        Questions? Reply to this email or visit the{" "}
        <Link href={`${APP_URL}/docs`} style={link}>
          docs
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;

const card: React.CSSProperties = {
  backgroundColor: "#0D0D0D",
  borderRadius: "12px",
  border: "1px solid #1A1A1A",
  padding: "36px 32px",
  marginBottom: "24px",
};

const greeting: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#E5E5E5",
  margin: "0 0 12px",
  letterSpacing: "-0.01em",
};

const intro: React.CSSProperties = {
  fontSize: "14px",
  color: "#888888",
  lineHeight: "22px",
  margin: "0 0 24px",
};

const cardDivider: React.CSSProperties = {
  borderColor: "#1A1A1A",
  borderTopWidth: "1px",
  margin: "0 0 20px",
};

const featureRow: React.CSSProperties = {
  marginBottom: "16px",
};

const featureRowLast: React.CSSProperties = {
  marginBottom: "24px",
};

const featureDot: React.CSSProperties = {
  width: "20px",
  verticalAlign: "top" as const,
  paddingTop: "6px",
};

const dot: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  backgroundColor: "#F97316",
};

const featureTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#D4D4D4",
  margin: "0 0 2px",
};

const featureDesc: React.CSSProperties = {
  fontSize: "13px",
  color: "#666666",
  lineHeight: "20px",
  margin: "0",
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
  borderRadius: "8px",
  padding: "12px 40px",
  display: "inline-block",
};

const sub: React.CSSProperties = {
  fontSize: "13px",
  color: "#444444",
  lineHeight: "22px",
  margin: "0",
};

const link: React.CSSProperties = {
  color: "#F97316",
  textDecoration: "none",
};
