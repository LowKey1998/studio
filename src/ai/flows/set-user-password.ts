'use server';

/**
 * @fileOverview An AI agent for setting a user's password and notifying them.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { sendEmail } from './send-email-flow';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';

const SetUserPasswordInputSchema = z.object({
  uid: z.string().describe('The Firebase UID of the user.'),
  newPassword: z.string().min(6).describe('The new password for the user (must be at least 6 characters).'),
  welcomeSubject: z.string().optional().describe('Custom subject for the notification email.'),
  welcomeBody: z.string().optional().describe('Custom HTML body for the notification email.'),
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
  async ({ uid, newPassword, welcomeSubject, welcomeBody }) => {
    const auth = getAuth(adminApp);
    try {
      const userRecord = await auth.getUser(uid);
      const userEmail = userRecord.email;
      const userName = userRecord.displayName || 'User';

      if (!userEmail) throw new Error('User does not have an email address.');

      const dbUserSnap = await get(ref(db, `users/${uid}`));
      const dbUser = dbUserSnap.val() || {};
      const systemId = dbUser.id || 'N/A';

      await auth.updateUser(uid, { password: newPassword });

      let subject = welcomeSubject || 'Your Password Has Been Reset';
      let body = welcomeBody || `
        <h2>Password Change Notification</h2>
        <p>Hello [Name],</p>
        <p>An administrator has reset your password for the portal. Your new login details are:</p>
        <ul>
          <li><strong>User ID:</strong> [UserID]</li>
          <li><strong>New Password:</strong> [Password]</li>
        </ul>
        <p>We strongly recommend you log in and change this password to something only you know.</p>
        <p>Best regards,<br/>The Administration</p>
      `;

      // Replace placeholders
      subject = subject.replace(/\[Name\]/g, userName).replace(/\[UserID\]/g, systemId).replace(/\[Password\]/g, newPassword);
      body = body.replace(/\[Name\]/g, userName).replace(/\[UserID\]/g, systemId).replace(/\[Password\]/g, newPassword);

      await sendEmail({ to: [userEmail], subject, body });

      return {
        success: true,
        message: `Successfully set password for ${userName} and sent notification.`,
      };
    } catch (error: any) {
      console.error('Error setting user password:', error);
      throw new Error(`Failed to set password: ${error.message}`);
    }
  }
);