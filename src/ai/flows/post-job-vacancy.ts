'use server';
/**
 * @fileOverview An AI agent for posting job vacancies.
 *
 * - postJobVacancy - A function that handles the job posting process.
 * - PostJobVacancyInput - The input type for the postJobVacancy function.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';
import { z } from 'genkit';

const PostJobVacancyInputSchema = z.object({
  title: z.string().describe('The title of the job.'),
  description: z.string().describe('A detailed description of the job and requirements.'),
  department: z.string().describe('The department the job belongs to.'),
  type: z.enum(['Full-time', 'Part-time', 'Contract']).describe('The type of employment.'),
  syndicate: z.boolean().describe('Whether to post this to external job boards.'),
});

export type PostJobVacancyInput = z.infer<typeof PostJobVacancyInputSchema>;

export async function postJobVacancy(input: PostJobVacancyInput): Promise<string> {
  const result = await postJobVacancyFlow(input);
  return result.result;
}

const postJobVacancyFlow = ai.defineFlow(
  {
    name: 'postJobVacancyFlow',
    inputSchema: PostJobVacancyInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async (input) => {
    const newVacancyRef = push(ref(db, 'vacancies'));
    await set(newVacancyRef, {
      title: input.title,
      description: input.description,
      department: input.department,
      type: input.type,
      status: 'Open',
      datePosted: new Date().toISOString(),
    });

    let resultMessage = `Vacancy "${input.title}" has been posted internally.`;

    if (input.syndicate) {
      // In a real application, this would trigger integrations with external job boards.
      console.log(`Simulating syndication for job: ${input.title} to external sites.`);
      resultMessage += ' It will also be posted to external job sites shortly.';
    }

    return {
      result: resultMessage,
    };
  }
);
