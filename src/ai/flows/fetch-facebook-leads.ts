
'use server';
/**
 * @fileOverview A flow for fetching new leads from the Facebook Graph API.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { ref, push, set, get } from 'firebase/database';

const FetchFacebookLeadsOutputSchema = z.object({
  count: z.number().describe('The number of new leads added to the system.'),
});
type FetchFacebookLeadsOutput = z.infer<typeof FetchFacebookLeadsOutputSchema>;

export async function fetchFacebookLeads(): Promise<FetchFacebookLeadsOutput> {
  const result = await fetchFacebookLeadsFlow();
  return result;
}

const fetchFacebookLeadsFlow = ai.defineFlow(
  {
    name: 'fetchFacebookLeadsFlow',
    inputSchema: z.void(),
    outputSchema: FetchFacebookLeadsOutputSchema,
  },
  async () => {
    const settingsRef = ref(db, 'settings/integrations/facebook');
    const settingsSnap = await get(settingsRef);

    if (!settingsSnap.exists()) {
        throw new Error('Facebook API credentials are not configured in System Settings.');
    }

    const { pageAccessToken, formId } = settingsSnap.val();

    if (!pageAccessToken || !formId) {
      throw new Error('Facebook Page Access Token and Form ID must be configured in System Settings.');
    }

    const url = `https://graph.facebook.com/v19.0/${formId}/leads?access_token=${pageAccessToken}`;
    
    let newLeadsCount = 0;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Facebook API Error:', errorData);
        throw new Error(`Failed to fetch leads from Facebook: ${errorData.error.message}`);
      }

      const { data } = await response.json();

      if (!data || data.length === 0) {
        return { count: 0 };
      }

      // In a real application, you'd want to check if the lead already exists
      // before adding it to avoid duplicates. For this demo, we'll add them all.
      for (const lead of data) {
        const leadData: Record<string, string> = {};
        lead.field_data.forEach((field: { name: string, values: string[] }) => {
          leadData[field.name] = field.values[0];
        });

        await push(ref(db, 'admissions/leads'), {
          name: leadData.full_name || 'N/A',
          email: leadData.email || '',
          phone: leadData.phone_number || '',
          source: 'Facebook',
          status: 'New',
          createdAt: new Date(lead.created_time).toISOString(),
        });
        newLeadsCount++;
      }
      
      return { count: newLeadsCount };

    } catch (error: any) {
      console.error('Error in fetchFacebookLeadsFlow:', error);
      throw error;
    }
  }
);
