'use server';

/**
 * @fileOverview An AI agent for setting a user's password and notifying them.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { sendEmail } from './send-email-flow';

const SetUserPasswordInputSchema = z.object({
  uid: z.string().describe('The Firebase UID of the user.'),
  newPassword: z.string().min(6).describe('The new password for the user (must be at least 6 characters).'),
});

export type SetUserPasswordInput = z.infer<typeof SetUserPasswordInputSchema>;

const SetUserPasswordOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type SetUserPasswordOutput = z.infer<typeof SetUserPasswordOutputSchema>;

export async function setUserPassword(input: SetUserPasswordInput): Promise<SetUserPasswordOutput> {
  return await setUserPasswordFlow(input);
}

const setUserPasswordFlow = ai.defineFlow(
  {
    name: 'setUserPasswordFlow',
    inputSchema: SetUserPasswordInputSchema,
    outputSchema: SetUserPasswordOutputSchema,
  },
  async ({ uid, newPassword }) => {
    const auth = getAuth(adminApp);
    try {
      // First, get the user's data to retrieve their email and name
      const userRecord = await auth.getUser(uid);
      const userEmail = userRecord.email;
      const userName = userRecord.displayName || 'User';

      if (!userEmail) {
        throw new Error('User does not have an email address.');
      }

      // Update the user's password
      await auth.updateUser(uid, {
        password: newPassword,
      });

      // Send a notification email
      const emailBody = `
        <h2>Password Change Notification</h2>
        <p>Hello ${userName},</p>
        <p>An administrator has reset your password for the portal. Your new login details are:</p>
        <ul>
          <li><strong>User ID:</strong> ${userRecord.customClaims?.systemId || 'Your registered ID'}</li>
          <li><strong>New Password:</strong> ${newPassword}</li>
        </ul>
        <p>We strongly recommend you log in and change this password to something only you know.</p>
        <p>Best regards,<br/>The Administration</p>
      `;

      await sendEmail({
        to: [userEmail],
        subject: 'Your Password Has Been Reset',
        body: emailBody,
      });

      return {
        success: true,
        message: `Successfully set password for ${userName} and sent a notification email.`,
      };
    } catch (error: any) {
      console.error('Error setting user password:', error);
      throw new Error(`Failed to set password: ${error.message}`);
    }
  }
);
