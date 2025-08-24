'use server';
/**
 * @fileOverview An AI agent for sending emails.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import * as nodemailer from 'nodemailer';

const SendEmailInputSchema = z.object({
  to: z.array(z.string().email()).describe('A list of recipient email addresses.'),
  subject: z.string().describe('The subject of the email.'),
  body: z.string().describe('The HTML content of the email.'),
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export async function sendEmail(input: SendEmailInput): Promise<{ result: string }> {
  const result = await sendEmailFlow(input);
  return result;
}

const sendEmailFlow = ai.defineFlow(
  {
    name: 'sendEmailFlow',
    inputSchema: SendEmailInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async ({ to, subject, body }) => {
    const settingsRef = ref(db, 'settings/integrations/smtp');
    const settingsSnap = await get(settingsRef);

    if (!settingsSnap.exists()) {
      throw new Error('SMTP settings are not configured in System Settings.');
    }
    const smtpConfig = settingsSnap.val();

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      throw new Error('SMTP host, port, user, and password must be configured.');
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${smtpConfig.fromName || 'Edutrack360'}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
        bcc: to.join(', '), // Use BCC to send to multiple recipients without exposing their addresses to each other
        subject: subject,
        html: body,
      });
      return { result: `Successfully sent email to ${to.length} recipients. Message ID: ${info.messageId}` };
    } catch (error: any) {
        console.error("Failed to send email:", error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
  }
);
