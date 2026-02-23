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

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to memctl - persistent memory for your AI coding agents">
      {/* Hero card */}
      <Section style={card}>
        <Text style={label}>WELCOME</Text>

        <Text style={heading}>Hey {name}</Text>

        <Text style={body}>
          memctl gives your AI agents a brain that persists. Every session
          picks up where the last one left off: your agent knows the open
          TODOs, remembers what broke yesterday, understands the architecture,
          and stays on the right branch. No more re-explaining your codebase
          from scratch.
        </Text>

        <Hr style={hr} />

        {/* Terminal snippet */}
        <Section style={terminalWrap}>
          <table cellPadding="0" cellSpacing="0" role="presentation">
            <tr>
              <td>
                <Text style={termLine}>
                  <span style={termPrefix}>$ </span>memctl status
                </Text>
              </td>
            </tr>
            <tr>
              <td>
                <Text style={termLine}>
                  <span style={termCheck}>&#10003; </span>3 open TODOs from last session
                </Text>
              </td>
            </tr>
            <tr>
              <td>
                <Text style={termLine}>
                  <span style={termCheck}>&#10003; </span>Branch: feat/auth-flow (12 memories)
                </Text>
              </td>
            </tr>
            <tr>
              <td>
                <Text style={termLine}>
                  <span style={termCheck}>&#10003; </span>Last session: refactored API middleware
                </Text>
              </td>
            </tr>
          </table>
        </Section>

        <Hr style={hr} />

        {/* CTA */}
        <Section style={btnWrap}>
          <Link href={`${APP_URL}/docs`} style={btn}>
            Read the docs &rarr;
          </Link>
        </Section>
      </Section>

      {/* Feature strip */}
      <Section style={stripCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={stripCell}>
              <Text style={stripLabel}>SESSION HISTORY</Text>
              <Text style={stripValue}>Agents recall past sessions, decisions, and context</Text>
            </td>
            <td style={stripDivider} />
            <td style={stripCell}>
              <Text style={stripLabel}>BRANCH-AWARE</Text>
              <Text style={stripValue}>Memory scoped to the branch your agent is working on</Text>
            </td>
            <td style={stripDivider} />
            <td style={stripCell}>
              <Text style={stripLabel}>TEAM SYNC</Text>
              <Text style={stripValue}>Shared knowledge across every agent and member</Text>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={sub}>
        Questions? Reply to this email or visit the{" "}
        <Link href={`${APP_URL}/docs`} style={link}>docs</Link>.
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;

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
  fontSize: "22px",
  fontWeight: 700,
  color: "#F5F5F5",
  letterSpacing: "-0.02em",
  margin: "0 0 16px",
  lineHeight: "1.2",
};

const body: React.CSSProperties = {
  fontSize: "14px",
  color: "#A1A1A1",
  lineHeight: "22px",
  margin: "0",
};

const hr: React.CSSProperties = {
  borderColor: "#1E1E1E",
  borderTopWidth: "1px",
  margin: "24px 0",
};

const terminalWrap: React.CSSProperties = {
  backgroundColor: "#0A0A0A",
  borderRadius: "6px",
  border: "1px solid #1A1A1A",
  padding: "16px 20px",
};

const termLine: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "12px",
  color: "#A1A1A1",
  lineHeight: "22px",
  margin: "0",
};

const termPrefix: React.CSSProperties = {
  color: "#F97316",
};

const termCheck: React.CSSProperties = {
  color: "#22C55E",
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

const stripCard: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "8px",
  border: "1px solid #1E1E1E",
  padding: "20px 16px",
  marginBottom: "24px",
};

const stripCell: React.CSSProperties = {
  verticalAlign: "top" as const,
  width: "33%",
  padding: "0 8px",
};

const stripDivider: React.CSSProperties = {
  width: "1px",
  backgroundColor: "#1E1E1E",
  verticalAlign: "top" as const,
};

const stripLabel: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: "9px",
  fontWeight: 600,
  letterSpacing: "0.1em",
  color: "#666666",
  margin: "0 0 4px",
};

const stripValue: React.CSSProperties = {
  fontSize: "11px",
  color: "#A1A1A1",
  lineHeight: "16px",
  margin: "0",
};

const sub: React.CSSProperties = {
  fontSize: "12px",
  color: "#525252",
  lineHeight: "20px",
  margin: "0",
};

const link: React.CSSProperties = {
  color: "#F97316",
  textDecoration: "none",
};
