import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export const resend = new Proxy({} as Resend, {
  get(_, prop) {
    return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const EMAIL_FROM = "memctl <noreply@memctl.com>";

const BLOCKED_ADMIN_PREFIXES = [
  "team@",
  "noreply@",
  "hello@",
  "info@",
  "support@",
];

export function isValidAdminEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  const lower = email.toLowerCase().trim();

  if (!lower.endsWith("@memctl.com")) {
    return { valid: false, error: "Only @memctl.com email addresses are allowed." };
  }

  for (const prefix of BLOCKED_ADMIN_PREFIXES) {
    if (lower === prefix + "memctl.com") {
      return { valid: false, error: "This service address cannot be used for admin login." };
    }
  }

  return { valid: true };
}

const isDev = process.env.NODE_ENV === "development";
const isSelfHostedEnv = process.env.SELF_HOSTED === "true";

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  // In self-hosted mode without Resend, silently skip emails
  if (isSelfHostedEnv && !process.env.RESEND_API_KEY) {
    return { data: { id: "self-hosted-noop-" + Date.now() }, error: null };
  }

  if (isDev && !process.env.RESEND_API_KEY) {
    console.log("\n📧 [DEV EMAIL] ─────────────────────────────────");
    console.log(`   To:      ${params.to}`);
    console.log(`   Subject: ${params.subject}`);
    console.log("   (Email rendered but not sent — no RESEND_API_KEY)");
    console.log("   Preview at: /admin/emails/preview");
    console.log("────────────────────────────────────────────────\n");
    return { data: { id: "dev-" + Date.now() }, error: null };
  }

  return resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    react: params.react,
  });
}
