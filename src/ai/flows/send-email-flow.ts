
'use server';
/**
 * @fileOverview An AI agent for sending emails.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { ref, get, push, set } from 'firebase/database';
import * as nodemailer from 'nodemailer';

const SendEmailInputSchema = z.object({
  to: z.array(z.string().email()).describe('A list of recipient email addresses.'),
  subject: z.string().describe('The subject of the email.'),
  body: z.string().describe('The HTML content of the email.'),
  log: z.boolean().optional().default(false).describe("Whether to log this communication in the parent communication logs."),
  userIds: z.array(z.string()).optional().describe("The user IDs of the recipients, if logging is enabled.")
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export async function sendEmail(input: SendEmailInput): Promise<{ result: string }> {
  const result = await sendEmailFlow(input);
  return result;
}

export const sendEmailFlow = ai.defineFlow(
  {
    name: 'sendEmailFlow',
    inputSchema: SendEmailInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async ({ to, subject, body, log, userIds }) => {
    const settingsRef = ref(db, 'settings/integrations/smtp');
    const settingsSnap = await get(settingsRef);

    if (!settingsSnap.exists()) {
      throw new Error('SMTP settings are not configured in System Settings.');
    }
    const smtpConfig = settingsSnap.val();

    if (!smtpConfig.user || !smtpConfig.pass) {
        throw new Error('SMTP user and password/key must be configured.');
    }

    let transporter;
    // Check if it's a Gmail address to use the simplified service config
    if (smtpConfig.user.endsWith('@gmail.com')) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            },
        });
    } else {
        // Fallback to generic SMTP for other providers
        if (!smtpConfig.host || !smtpConfig.port) {
            throw new Error('SMTP host and port must be configured for non-Gmail providers.');
        }
         transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.port === 465, // true for 465, false for other ports
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            },
        });
    }


    try {
      const info = await transporter.sendMail({
        from: `"${smtpConfig.fromName || 'Edutrack360'}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
        bcc: to.join(', '), // Use BCC to send to multiple recipients without exposing their addresses to each other
        subject: subject,
        html: body,
      });

      if (log) {
          const logRef = push(ref(db, 'communicationLogs'));
          await set(logRef, {
              type: 'Email',
              recipients: userIds || to,
              subject,
              body,
              timestamp: new Date().toISOString()
          });
      }

      return { result: `Successfully sent email to ${to.length} recipients. Message ID: ${info.messageId}` };
    } catch (error: any) {
        console.error("Failed to send email:", error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
  }
);
