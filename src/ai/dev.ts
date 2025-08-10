import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-notifications.ts';
import '@/ai/flows/post-job-vacancy.ts';
import '@/ai/flows/create-google-doc.ts';
import '@/ai/flows/send-payslip-email.ts';
import '@/ai/flows/update-user-status.ts';
import '@/ai/flows/sync-to-quickbooks.ts';
import '@/ai/flows/sync-to-sage.ts';
