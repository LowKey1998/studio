
'use server';

/**
 * @fileOverview Updates a user's account in Firebase Auth and Database.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { ref, update, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendEmail } from './send-email-flow';

const UpdateUserAccountInputSchema = z.object({
  uid: z.string().describe("The Firebase UID of the user."),
  name: z.string().describe("The user's full name."),
  email: z.string().email().describe("The user's email address."),
  phoneNumber: z.string().optional().describe("The user's phone number."),
  dbData: z.record(z.any()).describe("Additional user data for the database."),
});

export type UpdateUserAccountInput = z.infer<typeof UpdateUserAccountInputSchema>;

export async function updateUserAccount(input: UpdateUserAccountInput) {
  return await updateUserAccountFlow(input);
}

const updateUserAccountFlow = ai.defineFlow(
  {
    name: 'updateUserAccountFlow',
    inputSchema: UpdateUserAccountInputSchema,
  },
  async (input) => {
    const auth = getAuth(adminApp);
    
    // Get existing data for comparison
    const userRef = ref(db, `users/${input.uid}`);
    const existingSnap = await get(userRef);
    const existing = existingSnap.val() || {};

    const templatesSnap = await get(ref(db, 'settings/emailTemplates'));
    const templates = templatesSnap.val() || {};

    // Update Firebase Auth
    try {
        await auth.updateUser(input.uid, {
            email: input.email,
            displayName: input.name,
        });
    } catch (error: any) {
        console.error("Auth update error:", error);
        throw new Error(`Failed to update authentication record: ${error.message}`);
    }

    // Update Realtime Database
    try {
        await update(userRef, {
            ...input.dbData,
            name: input.name,
            email: input.email,
            phoneNumber: input.phoneNumber || '',
        });
    } catch (error: any) {
        console.error("Database update error:", error);
        throw new Error(`Failed to update database record: ${error.message}`);
    }

    // Handle Notifications
    try {
        // 1. Email Change
        if (existing.email && existing.email !== input.email && templates.emailChange?.enabled) {
            const tpl = templates.emailChange;
            const body = tpl.body.replace(/\[Name\]/g, input.name).replace(/\[NewEmail\]/g, input.email);
            await sendEmail({ to: [input.email], subject: tpl.subject, body });
        }

        // 2. ID Change
        if (existing.id && input.dbData.id && existing.id !== input.dbData.id && templates.idChange?.enabled) {
            const tpl = templates.idChange;
            const body = tpl.body.replace(/\[Name\]/g, input.name).replace(/\[OldID\]/g, existing.id).replace(/\[UserID\]/g, input.dbData.id);
            await sendEmail({ to: [input.email], subject: tpl.subject, body });
        }
    } catch (notifyError) {
        console.warn("Notification failed after account update:", notifyError);
    }
  }
);
