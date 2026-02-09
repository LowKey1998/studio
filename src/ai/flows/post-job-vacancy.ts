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

const ExternalPostSchema = z.object({
    summary: z.string().describe("A concise and engaging summary of the job vacancy, suitable for posting on external platforms like LinkedIn. It should be under 150 words.")
});

const externalPostPrompt = ai.definePrompt({
    name: 'externalPostPrompt',
    input: { schema: PostJobVacancyInputSchema },
    output: { schema: ExternalPostSchema },
    config: {
      responseMimeType: 'application/json',
    },
    prompt: `Based on the following job details, write a compelling and concise summary for an external job board.

Job Title: {{{title}}}
Department: {{{department}}}
Employment Type: {{{type}}}

Full Description:
{{{description}}}
`,
});


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
      const { output } = await externalPostPrompt(input);
      if (output) {
        console.log(`--- SIMULATING EXTERNAL POST ---`);
        console.log(`Syndicating post for: ${input.title}`);
        console.log(`Generated Summary: ${output.summary}`);
        console.log(`--- END SIMULATION ---`);
        resultMessage += ' A summary has been generated for external job sites.';
      }
    }

    return {
      result: resultMessage,
    };
  }
);
