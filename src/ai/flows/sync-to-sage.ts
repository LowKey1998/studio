'use server';

/**
 * @fileOverview AI agents for syncing financial data with Sage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Invoice Sync ---

const SyncInvoiceInputSchema = z.object({
  invoiceId: z.string(),
  studentName: z.string(),
  amount: z.number(),
  date: z.string(),
  description: z.string(),
});

export type SyncInvoiceInput = z.infer<typeof SyncInvoiceInputSchema>;

export async function syncInvoiceToSage(input: SyncInvoiceInput): Promise<void> {
  await syncInvoiceFlow(input);
}

const syncInvoiceFlow = ai.defineFlow(
  {
    name: 'syncInvoiceToSageFlow',
    inputSchema: SyncInvoiceInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    console.log(`Simulating Sage Invoice Sync for ${input.studentName}.`);
    console.log(`Invoice ID: ${input.invoiceId}, Amount: ${input.amount}, Date: ${input.date}`);
    console.log(`Description: ${input.description}`);
    // In a real application, you would make an API call to Sage here.
  }
);


// --- Expense Sync ---

const SyncExpenseInputSchema = z.object({
    expenseId: z.string(),
    category: z.string(),
    amount: z.number(),
    date: z.string(),
    vendor: z.string().optional(),
    description: z.string(),
});

export type SyncExpenseInput = z.infer<typeof SyncExpenseInputSchema>;

export async function syncExpenseToSage(input: SyncExpenseInput): Promise<void> {
    await syncExpenseFlow(input);
}

const syncExpenseFlow = ai.defineFlow(
  {
    name: 'syncExpenseToSageFlow',
    inputSchema: SyncExpenseInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    console.log(`Simulating Sage Expense Sync for category: ${input.category}.`);
    console.log(`Amount: ${input.amount}, Date: ${input.date}, Vendor: ${input.vendor || 'N/A'}`);
    // In a real application, you would make an API call to Sage here.
  }
);


// --- Payroll Sync ---

const SyncPayrollInputSchema = z.object({
    staffName: z.string(),
    staffId: z.string(),
    month: z.string(),
    grossSalary: z.number(),
    deductions: z.number(),
    netPay: z.number(),
});

export type SyncPayrollInput = z.infer<typeof SyncPayrollInputSchema>;

export async function syncPayrollToSage(input: SyncPayrollInput): Promise<void> {
    await syncPayrollFlow(input);
}

const syncPayrollFlow = ai.defineFlow(
  {
    name: 'syncPayrollToSageFlow',
    inputSchema: SyncPayrollInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    console.log(`Simulating Sage Payroll Sync for ${input.staffName} for ${input.month}.`);
    console.log(`Gross: ${input.grossSalary}, Deductions: ${input.deductions}, Net: ${input.netPay}`);
    // In a real application, you would make an API call to Sage here.
  }
);
