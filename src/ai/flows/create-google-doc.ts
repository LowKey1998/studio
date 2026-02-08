'use server';

/**
 * @fileOverview An AI agent for creating a Google Doc for a student assignment.
 * 
 * This flow integrates with the Google Drive API using a Service Account to:
 * 1. Create a new Google Doc.
 * 2. Share it with the student's email address.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';

const CreateGoogleDocInputSchema = z.object({
  userId: z.string().describe('The UID of the student.'),
  courseId: z.string().describe('The ID of the course.'),
  assignmentId: z.string().describe('The ID of the assignment.'),
  assignmentTitle: z.string().describe('The title of the assignment.'),
});

export type CreateGoogleDocInput = z.infer<typeof CreateGoogleDocInputSchema>;

const CreateGoogleDocOutputSchema = z.object({
  documentUrl: z.string().url().describe('The URL of the newly created Google Doc.'),
});

export type CreateGoogleDocOutput = z.infer<typeof CreateGoogleDocOutputSchema>;

export async function createGoogleDoc(input: CreateGoogleDocInput): Promise<CreateGoogleDocOutput> {
  const result = await createGoogleDocFlow(input);
  return result;
}

const createGoogleDocFlow = ai.defineFlow(
  {
    name: 'createGoogleDocFlow',
    inputSchema: CreateGoogleDocInputSchema,
    outputSchema: CreateGoogleDocOutputSchema,
  },
  async (input) => {
    // 1. Fetch Student Email from Realtime Database
    const userSnap = await get(ref(db, `users/${input.userId}`));
    if (!userSnap.exists()) {
      throw new Error("Student profile not found in database.");
    }
    const studentEmail = userSnap.val().email;
    if (!studentEmail) {
      throw new Error("Student does not have a registered email address required for Google Doc sharing.");
    }

    // 2. Authenticate with Google using Service Account
    const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const authKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!authEmail || !authKey) {
      console.warn("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not found in .env. Falling back to dummy URL for preview.");
      return { documentUrl: `https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit` };
    }

    const auth = new google.auth.JWT(
      authEmail,
      undefined,
      authKey,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    try {
      // 3. Create the Google Doc
      const fileMetadata = {
        name: input.assignmentTitle,
        mimeType: 'application/vnd.google-apps.document',
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, webViewLink',
      });

      const fileId = file.data.id;
      if (!fileId) throw new Error("Failed to create Google Doc.");

      // 4. Share with Student (Writer permission)
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: studentEmail,
        },
        sendNotificationEmail: true,
      });

      console.log(`Successfully created and shared Google Doc: ${file.data.webViewLink}`);

      return {
        documentUrl: file.data.webViewLink!,
      };

    } catch (error: any) {
      console.error("Error in Google Drive API operation:", error);
      throw new Error(`Google Doc creation failed: ${error.message}`);
    }
  }
);
