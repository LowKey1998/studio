'use server';

/**
 * @fileOverview An AI agent for sending payslip emails to staff.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
    // In a real application, you would integrate a service like SendGrid, Nodemailer, or Resend here.
    // For this demonstration, we will log the intended action to the console.
    console.log(`Simulating sending email to ${input.staffEmail}`);
    console.log(`Subject: Your Payslip for ${input.month}`);
    console.log(`
      Hi ${input.staffName},

      Please find your payslip details for ${input.month} attached.

      Summary:
      - Gross Salary: ZMW ${input.grossSalary.toFixed(2)}
      - Deductions: ZMW ${input.deductions.toFixed(2)}
      - Net Pay: ZMW ${input.netPay.toFixed(2)}

      If you have any questions, please contact the HR department.

      Best regards,
      Edutrack360 Finance Team
    `);

    // We return a success message as we are simulating the email sending.
    return {
      result: `Successfully sent payslip to ${input.staffEmail}.`,
    };
  }
);
