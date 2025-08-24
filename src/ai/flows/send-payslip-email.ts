
'use server';

/**
 * @fileOverview An AI agent for sending payslip emails to staff.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendEmail } from './send-email-flow';

const SendPayslipEmailInputSchema = z.object({
  staffName: z.string().describe('The name of the staff member.'),
  staffEmail: z.string().email().describe('The email address of the staff member.'),
  month: z.string().describe('The month for which the payslip is generated (e.g., "July 2024").'),
  grossSalary: z.number().describe('The gross salary amount.'),
  deductions: z.number().describe('The total deductions amount.'),
  netPay: z.number().describe('The final net pay amount.'),
});

export type SendPayslipEmailInput = z.infer<typeof SendPayslipEmailInputSchema>;

export async function sendPayslipEmail(input: SendPayslipEmailInput): Promise<string> {
  const result = await sendPayslipEmailFlow(input);
  return result.result;
}

const sendPayslipEmailFlow = ai.defineFlow(
  {
    name: 'sendPayslipEmailFlow',
    inputSchema: SendPayslipEmailInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async (input) => {
    const subject = `Your Payslip for ${input.month}`;
    const body = `
      <p>Hi ${input.staffName},</p>
      <p>Please find your payslip details for ${input.month} below.</p>
      <h3>Payslip Summary</h3>
      <ul>
        <li>Gross Salary: ZMW ${input.grossSalary.toFixed(2)}</li>
        <li>Deductions: ZMW ${input.deductions.toFixed(2)}</li>
        <li><strong>Net Pay: ZMW ${input.netPay.toFixed(2)}</strong></li>
      </ul>
      <p>If you have any questions, please contact the HR department.</p>
      <p>Best regards,<br/>Edutrack360 Finance Team</p>
    `;

    try {
      await sendEmail({
        to: [input.staffEmail],
        subject: subject,
        body: body,
      });
      return {
        result: `Successfully sent payslip to ${input.staffEmail}.`,
      };
    } catch (error: any) {
      console.error(`Failed to send payslip email to ${input.staffEmail}:`, error);
      throw new Error(`Failed to send payslip email: ${error.message}`);
    }
  }
);
