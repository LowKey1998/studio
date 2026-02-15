
'use server';

/**
 * @fileOverview AI agent flow for fetching the Chart of Accounts from QuickBooks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getQbAccounts } from '@/services/quickbooks';

export async function fetchAccountsFromQuickbooks(): Promise<any[]> {
    return await fetchAccountsFlow();
}

const fetchAccountsFlow = ai.defineFlow(
    {
        name: 'fetchAccountsFlow',
        inputSchema: z.void(),
        outputSchema: z.array(z.any()),
    },
    async () => {
        try {
            return await getQbAccounts();
        } catch (error: any) {
            console.error("Error fetching accounts:", error);
            throw new Error(`QuickBooks Fetch Failed: ${error.message}`);
        }
    }
);
