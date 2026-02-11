'use server';
/**
 * @fileOverview A flow for sending contact form submissions to the administrator.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { sendEmail } from './send-email-flow';

const ContactEmailInputSchema = z.object({
  name: z.string().describe("The name of the person submitting the form."),
  email: z.string().email().describe("The email address of the person submitting the form."),
  subject: z.string().describe("The subject of the inquiry."),
  message: z.string().describe("The detailed message."),
});

export async function sendContactEmail(input: z.infer<typeof ContactEmailInputSchema>) {
  return await sendContactEmailFlow(input);
}

const sendContactEmailFlow = ai.defineFlow(
  {
    name: 'sendContactEmailFlow',
    inputSchema: ContactEmailInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async (input) => {
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px; margin: auto;">
        <h2 style="color: #4c1d95;">Support Inquiry Received</h2>
        <p>A new support request has been submitted through the portal contact form.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>From:</strong></td>
            <td style="padding: 8px 0;">${input.name} (<a href="mailto:${input.email}">${input.email}</a>)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;"><strong>Subject:</strong></td>
            <td style="padding: 8px 0;">${input.subject}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; color: #333; line-height: 1.6;">
          ${input.message.replace(/\n/g, '<br>')}
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">This inquiry was routed to the administrator. Please reply directly to the sender's email above.</p>
      </div>
    `;

    return await sendEmail({
      to: ['geraldaphiri@gmail.com'],
      subject: `[Edutrack360 Support] ${input.subject}`,
      body: body,
    });
  }
);
