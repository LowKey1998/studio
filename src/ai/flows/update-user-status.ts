'use server';
/**
 * @fileOverview Updates a user's status in Firebase Auth.
 */

import { ai } from '@/ai/genkit';
import { adminApp } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'genkit';

const UpdateUserStatusInputSchema = z.object({
  uid: z.string().describe('The Firebase UID of the user to update.'),
  disabled: z.boolean().describe('Whether the user account should be disabled.'),
});

export type UpdateUserStatusInput = z.infer<
  typeof UpdateUserStatusInputSchema
>;

export async function updateUserStatus(
  input: UpdateUserStatusInput
): Promise<void> {
  return await updateUserStatusFlow(input);
}

const updateUserStatusFlow = ai.defineFlow(
  {
    name: 'updateUserStatusFlow',
    inputSchema: UpdateUserStatusInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    const auth = getAuth(adminApp);
    await auth.updateUser(input.uid, {
      disabled: input.disabled,
    });
  }
);
