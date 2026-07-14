// Supports Resend (RESEND_API_KEY) or SendGrid (SENDGRID_API_KEY).
// If neither key is set, email sending is silently skipped.

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const FROM = process.env.EMAIL_FROM ?? 'reminders@sflbiotrack.example';

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result.error) throw new Error(result.error.message);
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({ to, from: FROM, subject, html });
    return;
  }

  // No email provider configured — skip silently
}
