
'use server';

/**
 * @fileOverview Creates a user in Firebase Auth and Realtime Database, handling cases where the user already exists in auth.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { ref, set, get } from 'firebase/database';
import { db, createNotification } from '@/lib/firebase';
import { sendEmail } from './send-email-flow';
import { format } from 'date-fns';

const FindOrCreateUserInputSchema = z.object({
  id: z.string().describe("The user's system ID (e.g., STU-001)."),
  name: z.string().describe("The user's full name."),
  email: z.string().email().describe("The user's email address."),
  password: z.string().optional().describe("The user's initial password. Required if the user doesn't exist."),
  phoneNumber: z.string().optional().describe("The user's phone number."),
  role: z.enum(['Student', 'Staff', 'Admin']).describe("The user's primary role."),
  intakeId: z.string().optional().describe("The ID of the intake for students."),
  programmeId: z.string().optional().describe("The ID of the programme for students."),
  year: z.number().optional().describe("The year of study for students."),
  semesterId: z.string().optional().describe("The current semester ID for students."),
  dob: z.string().optional().describe("Date of birth."),
  gender: z.string().optional().describe("Gender."),
  nationalId: z.string().optional().describe("National ID number."),
  passport: z.string().optional().describe("Passport number."),
  address: z.string().optional().describe("Physical address."),
  disability: z.string().optional().describe("Disability information."),
  nationality: z.string().optional().describe("Nationality."),
  guardian: z.object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      email: z.string().optional(),
      contact: z.string().optional(),
  }).optional().describe("Guardian information."),
});
export type FindOrCreateUserInput = z.infer<typeof FindOrCreateUserInputSchema>;

const FindOrCreateUserOutputSchema = z.object({
  uid: z.string().describe("The Firebase UID of the user."),
  status: z.enum(['created', 'updated', 'exists']).describe("The result of the operation."),
});
export type FindOrCreateUserOutput = z.infer<typeof FindOrCreateUserOutputSchema>;


export async function findOrCreateUser(input: FindOrCreateUserInput): Promise<FindOrCreateUserOutput> {
  return await findOrCreateUserFlow(input);
}


const findOrCreateUserFlow = ai.defineFlow(
  {
    name: 'findOrCreateUserFlow',
    inputSchema: FindOrCreateUserInputSchema,
    outputSchema: FindOrCreateUserOutputSchema,
  },
  async (input) => {
    const auth = getAuth(adminApp);
    const { password, ...userData } = input;
    let authUser;
    let userExistsInAuth = false;

    try {
        authUser = await auth.getUserByEmail(input.email);
        userExistsInAuth = true;
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            if(!password) {
                 throw new Error(`User with email ${input.email} does not exist, and no password was provided to create one.`);
            }
            authUser = await auth.createUser({
                email: input.email,
                password: password,
                displayName: input.name,
                disabled: false
            });
        } else {
            throw error; // Re-throw other auth errors
        }
    }
    
    // At this point, we have a valid authUser, either found or newly created.
    const userRef = ref(db, `users/${authUser.uid}`);
    const userSnapshot = await get(userRef);

    if (userSnapshot.exists()) {
      return { uid: authUser.uid, status: 'exists' };
    }

    // User exists in auth but not in DB, or was newly created. Create DB record.
    await set(userRef, {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber || '',
        role: userData.role,
        intakeId: userData.intakeId || null,
        programmeId: userData.programmeId || null,
        year: userData.year || null,
        semesterId: userData.semesterId || null,
        dob: userData.dob || '',
        gender: userData.gender || '',
        nationalId: userData.nationalId || '',
        passport: userData.passport || '',
        address: userData.address || '',
        disability: userData.disability || '',
        nationality: userData.nationality || '',
        guardian: userData.guardian || {},
        status: 'active',
    });

    // Send welcome email only if a new password was set (i.e., a new auth user was created)
    if (!userExistsInAuth && password) {
         const portalUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-app-url.com'; // Fallback to a placeholder
         const welcomeEmailBody = `
            <h2>Welcome to the Institution!</h2>
            <p>An account has been created for you. You can now access the portal using the credentials below.</p>
            <ul>
                <li><strong>Portal Link:</strong> <a href="${portalUrl}">${portalUrl}</a></li>
                <li><strong>User ID:</strong> ${input.id}</li>
                <li><strong>Password:</strong> ${password}</li>
            </ul>
            <p>We recommend you log in and change your password at your earliest convenience. If you did not register for an account, please contact us immediately.</p>
            <p>Best regards,<br/>The Administration</p>
        `;
        await sendEmail({ to: [input.email], subject: `Your Student Account Details`, body: welcomeEmailBody });
    }

    return { uid: authUser.uid, status: userExistsInAuth ? 'updated' : 'created' };
  }
);
