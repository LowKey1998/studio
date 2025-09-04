
'use server';

/**
 * @fileOverview AI agents for syncing financial data with QuickBooks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createQbInvoice, createQbExpense, createQbJournalEntryForPayroll } from '@/services/quickbooks';

// --- Invoice Sync ---

const SyncInvoiceInputSchema = z.object({
  invoiceId: z.string(),
  studentName: z.string(),
  amount: z.number(),
  date: z.string(),
  description: z.string(),
});

export type SyncInvoiceInput = z.infer<typeof SyncInvoiceInputSchema>;

export async function syncInvoiceToQuickbooks(input: SyncInvoiceInput): Promise<void> {
  await syncInvoiceFlow(input);
}

const syncInvoiceFlow = ai.defineFlow(
  {
    name: 'syncInvoiceFlow',
    inputSchema: SyncInvoiceInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    await createQbInvoice({
      CustomerRef: { name: input.studentName, value: input.invoiceId.split('-')[0] }, // Using student name as customer, and part of invoice as customer ID
      Line: [{
        Amount: input.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1' } // Assuming a generic service item with ID '1'
        }
      }],
      DocNumber: input.invoiceId,
      TxnDate: input.date,
    });
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

export async function syncExpenseToQuickbooks(input: SyncExpenseInput): Promise<void> {
    await syncExpenseFlow(input);
}

const syncExpenseFlow = ai.defineFlow(
  {
    name: 'syncExpenseFlow',
    inputSchema: SyncExpenseInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    await createQbExpense({
      AccountRef: { value: '41' }, // Expense Account
      PaymentType: 'Check',
      TotalAmt: input.amount,
      EntityRef: input.vendor ? { name: input.vendor, type: 'Vendor', value: '0' } : undefined, // Vendor reference if exists
      Line: [{
          Amount: input.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
              AccountRef: { name: input.category, value: '41' } // Map category to an expense account
          }
      }]
    });
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

export async function syncPayrollToQuickbooks(input: SyncPayrollInput): Promise<void> {
    await syncPayrollFlow(input);
}

const syncPayrollFlow = ai.defineFlow(
  {
    name: 'syncPayrollFlow',
    inputSchema: SyncPayrollInputSchema,
    outputSchema: z.void(),
  },
  async (input) => {
    await createQbJournalEntryForPayroll({
        TxnDate: new Date().toISOString().split('T')[0],
        Line: [
            {
                DetailType: "JournalEntryLineDetail",
                Amount: input.grossSalary,
                JournalEntryLineDetail: {
                    PostingType: "Debit",
                    AccountRef: { name: "Payroll Expenses", value: "60" } 
                },
                Description: `Payroll for ${input.staffName} - ${input.month}`
            },
            {
                DetailType: "JournalEntryLineDetail",
                Amount: input.deductions,
                JournalEntryLineDetail: {
                    PostingType: "Credit",
                    AccountRef: { name: "Payroll Liabilities", value: "61" }
                },
                Description: `Deductions for ${input.staffName}`
            },
            {
                DetailType: "JournalEntryLineDetail",
                Amount: input.netPay,
                JournalEntryLineDetail: {
                    PostingType: "Credit",
                    AccountRef: { name: "Bank", value: "35" } // Assuming payment from main bank account
                },
                Description: `Net Pay to ${input.staffName}`
            }
        ]
    });
  }
);
