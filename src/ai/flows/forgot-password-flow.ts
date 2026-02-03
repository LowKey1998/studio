
'use server';
/**
 * @fileOverview A flow for sending custom password reset emails using the app's SMTP settings.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendEmail } from './send-email-flow';

const ForgotPasswordInputSchema = z.object({
  email: z.string().email().describe("The user's email address."),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export async function sendCustomPasswordReset(input: ForgotPasswordInput) {
  return await forgotPasswordFlow(input);
}

const forgotPasswordFlow = ai.defineFlow(
  {
    name: 'forgotPasswordFlow',
    inputSchema: ForgotPasswordInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    const auth = getAuth(adminApp);
    try {
      // 1. Generate the reset link using Firebase Admin SDK
      const link = await auth.generatePasswordResetLink(input.email);

      // 2. Fetch institution settings for branding
      const settingsSnap = await get(ref(db, 'settings/institution'));
      const institutionName = settingsSnap.exists() ? settingsSnap.val().name : 'Edutrack360';

      // 3. Send the custom email
      const subject = `Reset Your Password - ${institutionName}`;
      const body = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4c1d95;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your account at <strong>${institutionName}</strong>.</p>
          <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #4c1d95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
          <p>If you have trouble with the button, copy and paste the link below into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${link}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">This is an automated message from the ${institutionName} portal. Please do not reply to this email.</p>
        </div>
      `;

      await sendEmail({ 
        to: [input.email], 
        subject, 
        body 
      });

      return { success: true, message: 'Custom reset email sent.' };
    } catch (error: any) {
      console.error('Error generating reset link:', error);
      throw new Error(`Failed to send reset email: ${error.message}`);
    }
  }
);
