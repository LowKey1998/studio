
'use server';
/**
 * @fileOverview An AI agent for sending SMS messages via Twilio.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { ref, get, push, set } from 'firebase/database';
import twilio from 'twilio';

const SendSmsInputSchema = z.object({
  to: z.array(z.string()).describe('A list of recipient phone numbers in E.164 format.'),
  body: z.string().describe('The content of the SMS message.'),
  log: z.boolean().optional().default(false).describe("Whether to log this communication in the parent communication logs."),
  userIds: z.array(z.string()).optional().describe("The user IDs of the recipients, if logging is enabled.")
});
export type SendSmsInput = z.infer<typeof SendSmsInputSchema>;

export async function sendSms(input: SendSmsInput): Promise<{ result: string }> {
  const result = await sendSmsFlow(input);
  return result;
}

export const sendSmsFlow = ai.defineFlow(
  {
    name: 'sendSmsFlow',
    inputSchema: SendSmsInputSchema,
    outputSchema: z.object({ result: z.string() }),
  },
  async ({ to, body, log, userIds }) => {
    const settingsRef = ref(db, 'settings/integrations/twilio');
    const settingsSnap = await get(settingsRef);

    if (!settingsSnap.exists()) {
      throw new Error('Twilio settings are not configured in System Settings.');
    }
    const twilioConfig = settingsSnap.val();

    if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
        throw new Error('Twilio Account SID, Auth Token, and From Number must be configured.');
    }

    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    let successCount = 0;
    let failCount = 0;

    const promises = to.map(phoneNumber => {
        return client.messages.create({
            body,
            from: twilioConfig.fromNumber,
            to: phoneNumber
        })
        .then(message => {
            console.log(`Message sent to ${phoneNumber}: ${message.sid}`);
            successCount++;
        })
        .catch(error => {
            console.error(`Failed to send to ${phoneNumber}:`, error.message);
            failCount++;
        });
    });

    await Promise.all(promises);
    
     if (log) {
        const logRef = push(ref(db, 'communicationLogs'));
        await set(logRef, {
            type: 'SMS',
            recipients: userIds || to,
            body,
            timestamp: new Date().toISOString()
        });
    }
    
    return { result: `SMS sending complete. Successful: ${successCount}. Failed: ${failCount}.` };
  }
);
