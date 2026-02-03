
'use server';

/**
 * @fileOverview Updates a user's account in Firebase Auth and Database.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';

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
        const userRef = ref(db, `users/${input.uid}`);
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
  }
);
