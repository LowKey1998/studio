
import { db } from '@/lib/firebase';
import { get, ref, update } from 'firebase/database';
import QuickBooks from 'node-quickbooks';

// Helper function to get a fully configured QuickBooks client
async function getQuickBooksClient() {
    const settingsRef = ref(db, 'settings/integrations/quickbooks');
    const snapshot = await get(settingsRef);

    if (!snapshot.exists()) {
        throw new Error('QuickBooks settings not found in database.');
    }

    const settings = snapshot.val();

    if (!settings.clientId || !settings.clientSecret || !settings.accessToken || !settings.realmId) {
        throw new Error('QuickBooks integration is not fully configured or connected.');
    }

    // Optional: Refresh token if it's expired
    // For simplicity, we're not implementing the full refresh flow here,
    // but in a production app, you'd check settings.tokenExpiry against the current time.

    const qbo = new QuickBooks(
        settings.clientId,
        settings.clientSecret,
        settings.accessToken,
        false, // no token secret for oAuth 2.0
        settings.realmId,
        process.env.NODE_ENV === 'production', // use sandbox for development
        false, // enable debugging
        null, // no minor version
        '2.0', // oAuth 2.0
        settings.refreshToken
    );

    return qbo;
}

// Promisify QuickBooks functions
const promisify = (qbo: QuickBooks, func: Function) => {
    return (...args: any[]) => {
        return new Promise((resolve, reject) => {
            func.apply(qbo, [...args, (err: any, data: any) => {
                if (err) return reject(err);
                resolve(data);
            }]);
        });
    };
};

// --- API Functions ---

export async function createQbInvoice(invoiceData: any): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createInvoiceAsync = promisify(qbo, qbo.createInvoice);
    try {
        const createdInvoice = await createInvoiceAsync(invoiceData);
        console.log('Successfully created QuickBooks Invoice:', createdInvoice);
        return createdInvoice;
    } catch (error) {
        console.error('Error creating QuickBooks invoice:', error);
        throw error;
    }
}

export async function createQbExpense(expenseData: any): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createExpenseAsync = promisify(qbo, qbo.createExpense);
    try {
        const createdExpense = await createExpenseAsync(expenseData);
        console.log('Successfully created QuickBooks Expense:', createdExpense);
        return createdExpense;
    } catch (error) {
        console.error('Error creating QuickBooks expense:', error);
        throw error;
    }
}

export async function createQbJournalEntryForPayroll(entryData: any): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createJournalEntryAsync = promisify(qbo, qbo.createJournalEntry);
    try {
        const createdEntry = await createJournalEntryAsync(entryData);
        console.log('Successfully created QuickBooks Journal Entry for Payroll:', createdEntry);
        return createdEntry;
    } catch (error) {
        console.error('Error creating QuickBooks journal entry:', error);
        throw error;
    }
}
