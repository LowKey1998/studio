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

    // Initialize QuickBooks Client
    const qbo = new QuickBooks(
        settings.clientId,
        settings.clientSecret,
        settings.accessToken,
        false, // no token secret for oAuth 2.0
        settings.realmId,
        process.env.NODE_ENV !== 'production', // true = sandbox
        false, // enable debugging
        null, // no minor version
        '2.0', // oAuth 2.0
        settings.refreshToken
    );

    return qbo;
}

// Promisify QuickBooks functions for async/await usage
const promisify = (qbo: any, func: Function) => {
    return (...args: any[]) => {
        return new Promise((resolve, reject) => {
            func.apply(qbo, [...args, (err: any, data: any) => {
                if (err) return reject(err);
                resolve(data);
            }]);
        });
    };
};

const findCustomerByDisplayName = async (qbo: any, displayName: string): Promise<any> => {
    const findCustomersAsync = promisify(qbo, qbo.findCustomers);
    const response: any = await findCustomersAsync({ DisplayName: displayName });
    return response.QueryResponse.Customer?.[0];
};

const createCustomer = async (qbo: any, customerData: any): Promise<any> => {
    const createCustomerAsync = promisify(qbo, qbo.createCustomer);
    return await createCustomerAsync(customerData);
};

const findOrCreateCustomer = async (qbo: any, studentName: string, studentId: string) => {
    const displayName = `${studentName} (${studentId})`;
    let customer = await findCustomerByDisplayName(qbo, displayName);
    if (!customer) {
        customer = await createCustomer(qbo, { 
            DisplayName: displayName,
            GivenName: studentName.split(' ')[0],
            FamilyName: studentName.split(' ').slice(1).join(' ')
        });
    }
    return customer;
};


// --- API Functions ---

export async function createQbInvoice(invoiceData: any): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createInvoiceAsync = promisify(qbo, qbo.createInvoice);
    try {
        const studentId = invoiceData.CustomerRef.value;
        const studentName = invoiceData.CustomerRef.name;
        const customer = await findOrCreateCustomer(qbo, studentName, studentId);
        
        // Map to QB Invoice Schema
        const qbInvoiceData = {
            ...invoiceData,
            CustomerRef: { value: customer.Id }
        };

        const createdInvoice = await createInvoiceAsync(qbInvoiceData);
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
        return createdEntry;
    } catch (error) {
        console.error('Error creating QuickBooks journal entry:', error);
        throw error;
    }
}

export async function createQbPayment(paymentData: { studentId: string, studentName: string, amount: number, invoiceId: string, date: string, description?: string }): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createPaymentAsync = promisify(qbo, qbo.createPayment);
    const findInvoicesAsync = promisify(qbo, qbo.findInvoices);

    try {
        const customer = await findOrCreateCustomer(qbo, paymentData.studentName, paymentData.studentId);
        
        // Find the invoice in QB to link the payment
        const invoices: any = await findInvoicesAsync({ DocNumber: paymentData.invoiceId });
        
        if (!invoices.QueryResponse.Invoice || invoices.QueryResponse.Invoice.length === 0) {
            throw new Error(`Could not find matching QB invoice for DocNumber: ${paymentData.invoiceId}`);
        }
        
        const qbInvoice = invoices.QueryResponse.Invoice[0];

        const paymentPayload = {
            CustomerRef: { value: customer.Id },
            TotalAmt: paymentData.amount,
            TxnDate: paymentData.date,
            PrivateNote: paymentData.description,
            Line: [{
                Amount: paymentData.amount,
                LinkedTxn: [{
                    TxnId: qbInvoice.Id,
                    TxnType: 'Invoice'
                }]
            }]
        };

        const createdPayment = await createPaymentAsync(paymentPayload);
        return createdPayment;

    } catch (error) {
         console.error('Error creating QuickBooks payment:', error);
        throw error;
    }
}

export async function voidQbInvoice(invoiceId: string): Promise<any> {
    const qbo = await getQuickBooksClient();
    const findInvoicesAsync = promisify(qbo, qbo.findInvoices);
    const voidInvoiceAsync = promisify(qbo, qbo.voidInvoice);

    try {
        const invoices: any = await findInvoicesAsync({ DocNumber: invoiceId });
        if (!invoices.QueryResponse.Invoice || invoices.QueryResponse.Invoice.length === 0) {
            console.warn(`QuickBooks invoice with DocNumber ${invoiceId} not found. Skipping void.`);
            return;
        }

        const qbInvoice = invoices.QueryResponse.Invoice[0];
        const voidedInvoice = await voidInvoiceAsync(qbInvoice);
        return voidedInvoice;

    } catch(error) {
        console.error('Error voiding QuickBooks invoice:', error);
        throw error;
    }
}