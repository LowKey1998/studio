'use server';

/**
 * @fileOverview AI agents for syncing financial data with QuickBooks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createQbInvoice, createQbExpense, createQbJournalEntryForPayroll, voidQbInvoice as voidQbInvoiceService, createQbPayment as createQbPaymentService, getQbInvoices } from '@/services/quickbooks';

// --- Fetch Invoices ---
export async function fetchInvoicesFromQuickbooks(): Promise<any[]> {
    return await fetchInvoicesFlow();
}

const fetchInvoicesFlow = ai.defineFlow(
    {
        name: 'fetchInvoicesFlow',
        inputSchema: z.void(),
        outputSchema: z.array(z.any()),
    },
    async () => {
        return await getQbInvoices();
    }
);

// --- Invoice Sync ---

const SyncInvoiceInputSchema = z.object({
  invoiceId: z.string(),
  studentName: z.string(),
  studentId: z.string(),
  amount: z.number(),
  date: z.string(),
  description: z.string(),
});

export type SyncInvoiceInput = z.infer<typeof SyncInvoiceInputSchema>;

export async function syncInvoiceToQuickbooks(input: SyncInvoiceInput) {
  return await syncInvoiceFlow(input);
}

const syncInvoiceFlow = ai.defineFlow(
  {
    name: 'syncInvoiceFlow',
    inputSchema: SyncInvoiceInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    await createQbInvoice({
      CustomerRef: { name: input.studentName, value: input.studentId },
      Line: [{
        Amount: input.amount,
        Description: input.description,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1' }
        }
      }],
      DocNumber: input.invoiceId,
      TxnDate: input.date,
    });
    return { success: true };
  }
);

// --- Payment Sync ---
const SyncPaymentInputSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  amount: z.number(),
  invoiceId: z.string(),
  date: z.string(),
  description: z.string().optional(),
});
export type SyncPaymentInput = z.infer<typeof SyncPaymentInputSchema>;

export async function createQbPayment(input: SyncPaymentInput) {
  return await syncPaymentFlow(input);
}

const syncPaymentFlow = ai.defineFlow(
  {
    name: 'syncPaymentFlow',
    inputSchema: SyncPaymentInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    await createQbPaymentService(input);
    return { success: true };
  }
);


// --- Void Invoice ---
export async function voidQbInvoice(invoiceId: string) {
    return await voidQbInvoiceFlow({ invoiceId });
}

const voidQbInvoiceFlow = ai.defineFlow(
  {
    name: 'voidQbInvoiceFlow',
    inputSchema: z.object({ invoiceId: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ invoiceId }) => {
    await voidQbInvoiceService(invoiceId);
    return { success: true };
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

export async function syncExpenseToQuickbooks(input: SyncExpenseInput) {
    return await syncExpenseFlow(input);
}

const syncExpenseFlow = ai.defineFlow(
  {
    name: 'syncExpenseFlow',
    inputSchema: SyncExpenseInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    await createQbExpense({
      AccountRef: { value: '41' },
      PaymentType: 'Check',
      TotalAmt: input.amount,
      EntityRef: input.vendor ? { name: input.vendor, type: 'Vendor', value: '0' } : undefined,
      Line: [{
          Amount: input.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
              AccountRef: { name: input.category, value: '41' }
          }
      }]
    });
    return { success: true };
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

export async function syncPayrollToQuickbooks(input: SyncPayrollInput) {
    return await syncPayrollFlow(input);
}

const syncPayrollFlow = ai.defineFlow(
  {
    name: 'syncPayrollFlow',
    inputSchema: SyncPayrollInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
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
                    AccountRef: { name: "Bank", value: "35" }
                },
                Description: `Net Pay to ${input.staffName}`
            }
        ]
    });
    return { success: true };
  }
);
