import { db } from './firebase';
import { ref, push } from 'firebase/database';

export async function logFinancialAudit(
    operatorEmail: string,
    operatorName: string,
    category: string,
    action: string,
    details: string
) {
    try {
        await push(ref(db, 'financialAuditLogs'), {
            operatorEmail,
            operatorName,
            category,
            action,
            details,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error('Failed to log financial audit:', e);
    }
}
