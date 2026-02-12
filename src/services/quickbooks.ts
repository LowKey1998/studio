
import { db } from '@/lib/firebase';
import { get, ref } from 'firebase/database';
import QuickBooks from 'node-quickbooks';

/**
 * Helper function to initialize a real QuickBooks client using production settings.
 * Retrieves OAuth2 tokens and realmId from the Realtime Database.
 */
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

    // Initialize the official QuickBooks Client
    const qbo = new QuickBooks(
        settings.clientId,
        settings.clientSecret,
        settings.accessToken,
        false, // no token secret for OAuth 2.0
        settings.realmId,
        process.env.NODE_ENV !== 'production', // Use sandbox mode only in development
        true, // enable debugging
        null, // no minor version
        '2.0', // OAuth 2.0
        settings.refreshToken
    );

    return qbo;
}

/**
 * Promisifies a standard node-quickbooks function for cleaner async/await usage.
 */
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

/**
 * Ensures a Customer record exists in QuickBooks for the given student.
 */
const findOrCreateCustomer = async (qbo: any, studentName: string, studentId: string) => {
    const displayName = `${studentName} (${studentId})`;
    const findCustomersAsync = promisify(qbo, qbo.findCustomers);
    const createCustomerAsync = promisify(qbo, qbo.createCustomer);

    const response: any = await findCustomersAsync({ DisplayName: displayName });
    let customer = response.QueryResponse.Customer?.[0];

    if (!customer) {
        customer = await createCustomerAsync({ 
            DisplayName: displayName,
            GivenName: studentName.split(' ')[0],
            FamilyName: studentName.split(' ').slice(1).join(' '),
            Notes: `System ID: ${studentId}`
        });
    }
    return customer;
};

// --- REAL API FUNCTIONS ---

/**
 * Synchronizes a system invoice to QuickBooks as a new Invoice entity.
 */
export async function createQbInvoice(invoiceData: { 
    CustomerRef: { name: string, value: string }, 
    Line: any[], 
    DocNumber: string, 
    TxnDate: string 
}): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createInvoiceAsync = promisify(qbo, qbo.createInvoice);
    
    try {
        const studentId = invoiceData.CustomerRef.value;
        const studentName = invoiceData.CustomerRef.name;
        const customer = await findOrCreateCustomer(qbo, studentName, studentId);
        
        const qbPayload = {
            ...invoiceData,
            CustomerRef: { value: customer.Id }
        };

        return await createInvoiceAsync(qbPayload);
    } catch (error) {
        console.error('Error in QuickBooks createInvoice:', error);
        throw error;
    }
}

/**
 * Records a new Expense in QuickBooks for institutional spending.
 */
export async function createQbExpense(expenseData: any): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createExpenseAsync = promisify(qbo, qbo.createExpense);
    try {
        return await createExpenseAsync(expenseData);
    } catch (error) {
        console.error('Error in QuickBooks createExpense:', error);
        throw error;
    }
}

/**
 * Creates a Payment entry in QuickBooks, linked to a specific Invoice.
 */
export async function createQbPayment(paymentData: { 
    studentId: string, 
    studentName: string, 
    amount: number, 
    invoiceId: string, 
    date: string, 
    description?: string 
}): Promise<any> {
    const qbo = await getQuickBooksClient();
    const createPaymentAsync = promisify(qbo, qbo.createPayment);
    const findInvoicesAsync = promisify(qbo, qbo.findInvoices);

    try {
        const customer = await findOrCreateCustomer(qbo, paymentData.studentName, paymentData.studentId);
        const invoices: any = await findInvoicesAsync({ DocNumber: paymentData.invoiceId });
        
        if (!invoices.QueryResponse.Invoice?.length) {
            throw new Error(`Invoice with DocNumber ${paymentData.invoiceId} not found in QuickBooks.`);
        }
        
        const qbInvoice = invoices.QueryResponse.Invoice[0];

        const payload = {
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

        return await createPaymentAsync(payload);
    } catch (error) {
         console.error('Error in QuickBooks createPayment:', error);
        throw error;
    }
}

/**
 * Voids an existing Invoice in QuickBooks.
 */
export async function voidQbInvoice(invoiceId: string): Promise<any> {
    const qbo = await getQuickBooksClient();
    const findInvoicesAsync = promisify(qbo, qbo.findInvoices);
    const voidInvoiceAsync = promisify(qbo, qbo.voidInvoice);

    try {
        const invoices: any = await findInvoicesAsync({ DocNumber: invoiceId });
        if (!invoices.QueryResponse.Invoice?.length) {
            console.warn(`QuickBooks invoice with DocNumber ${invoiceId} not found. Skipping void.`);
            return;
        }

        const qbInvoice = invoices.QueryResponse.Invoice[0];
        return await voidInvoiceAsync(qbInvoice);
    } catch(error) {
        console.error('Error in QuickBooks voidInvoice:', error);
        throw error;
    }
}
