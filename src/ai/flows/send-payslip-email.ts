
'use server';

/**
 * @fileOverview An AI agent for sending payslip emails to staff.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendEmail } from './send-email-flow';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SendPayslipEmailInputSchema = z.object({
  staffName: z.string().describe('The name of the staff member.'),
  staffId: z.string().describe('The staff system ID (e.g. STF-001).'),
  staffEmail: z.string().email().describe('The email address of the staff member.'),
  month: z.string().describe('The month for which the payslip is generated (e.g., "July 2024").'),
  grossSalary: z.number().describe('The gross salary amount.'),
  deductions: z.number().describe('The total deductions amount.'),
  netPay: z.number().describe('The final net pay amount.'),
});

export type SendPayslipEmailInput = z.infer<typeof SendPayslipEmailInputSchema>;

const generatePayslipPdf = (input: SendPayslipEmailInput): string => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Payslip", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`For the month of: ${input.month}`, 105, 30, { align: 'center' });

    // Employee Details
    doc.setFontSize(12);
    doc.text(`Employee Name: ${input.staffName}`, 14, 50);
    doc.text(`Employee ID: ${input.staffId}`, 14, 57);

    // Earnings and Deductions Table
    const tableData = [
        ['Earnings', ''],
        ['Gross Salary', `ZMW ${input.grossSalary.toFixed(2)}`],
        ['Deductions', ''],
        ['Total Deductions', `(ZMW ${input.deductions.toFixed(2)})`],
        ['', ''],
        ['Net Pay', `ZMW ${input.netPay.toFixed(2)}`],
    ];

    autoTable(doc, {
        startY: 70,
        head: [['Description', 'Amount']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 12 },
        headStyles: { fillColor: [41, 128, 185] },
        didParseCell: function (data) {
            if (data.row.index === 5) { // Net Pay row
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // Footer
    doc.setFontSize(10);
    doc.text("This is a system-generated document.", 14, (doc as any).lastAutoTable.finalY + 20);
    
    return doc.output('datauristring', { filename: `Payslip-${input.month}.pdf` }).split('base64,')[1];
};


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
      <p>Please find your payslip for ${input.month} attached to this email.</p>
      <h3>Payslip Summary</h3>
      <ul>
        <li>Gross Salary: ZMW ${input.grossSalary.toFixed(2)}</li>
        <li>Deductions: ZMW ${input.deductions.toFixed(2)}</li>
        <li><strong>Net Pay: ZMW ${input.netPay.toFixed(2)}</strong></li>
      </ul>
      <p>If you have any questions, please contact the HR department.</p>
      <p>Best regards,<br/>Edutrack360 Finance Team</p>
    `;

    const pdfContent = generatePayslipPdf(input);
    const attachment = {
        filename: `Payslip-${input.month.replace(' ', '-')}.pdf`,
        content: pdfContent,
        contentType: 'application/pdf'
    };

    try {
      await sendEmail({
        to: [input.staffEmail],
        subject: subject,
        body: body,
        attachments: [attachment]
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
