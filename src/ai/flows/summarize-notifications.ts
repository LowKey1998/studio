'use server';

/**
 * @fileOverview Summarizes notifications for a user.
 *
 * - summarizeNotifications - A function that summarizes notifications for a user.
 * - SummarizeNotificationsInput - The input type for the summarizeNotifications function.
 * - SummarizeNotificationsOutput - The return type for the summarizeNotifications function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeNotificationsInputSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      timestamp: z.string(),
      isRead: z.boolean().default(false),
    })
  ).describe('A list of notifications to summarize.'),
});
export type SummarizeNotificationsInput = z.infer<typeof SummarizeNotificationsInputSchema>;

const SummarizeNotificationsOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the provided notifications.'),
});
export type SummarizeNotificationsOutput = z.infer<typeof SummarizeNotificationsOutputSchema>;

export async function summarizeNotifications(input: SummarizeNotificationsInput): Promise<SummarizeNotificationsOutput> {
  return summarizeNotificationsFlow(input);
}

const summarizeNotificationsPrompt = ai.definePrompt({
  name: 'summarizeNotificationsPrompt',
  input: {schema: SummarizeNotificationsInputSchema},
  output: {schema: SummarizeNotificationsOutputSchema},
  config: {
    responseMimeType: 'application/json',
  },
  prompt: `You are a helpful assistant that summarizes a list of notifications into a concise summary.

  Here are the notifications:
  {{#each notifications}}
  - {{this.message}} ({{this.timestamp}})
  {{/each}}

  Provide a short summary of these notifications:
  `,
});

const summarizeNotificationsFlow = ai.defineFlow(
  {
    name: 'summarizeNotificationsFlow',
    inputSchema: SummarizeNotificationsInputSchema,
    outputSchema: SummarizeNotificationsOutputSchema,
  },
  async input => {
    const {output} = await summarizeNotificationsPrompt(input);
    return output!;
  }
);
