import nodemailer from "nodemailer";
import { lookup } from "dns/promises";
import { config } from "@/config/env";

// nodemailer's own hostname resolution hangs indefinitely in some sandboxed
// network environments even though plain Node DNS/TCP/TLS all work fine.
// Resolving the hostname ourselves and connecting to the IP directly (with
// `servername` set for correct TLS SNI/certificate validation) sidesteps it.
async function createTransport() {
  const host = config.smtp.host ?? "";
  const { address } = await lookup(host);
  return nodemailer.createTransport({
    host: address,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    tls: { servername: host },
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.password?.replace(/\s+/g, "") }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const transporter = await createTransport();
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: "Reset your Basura Watch password",
    text: `We received a request to reset your Basura Watch password.\n\nReset it here (expires in 30 minutes): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <p>We received a request to reset your Basura Watch password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (expires in 30 minutes).</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `,
  });
}
