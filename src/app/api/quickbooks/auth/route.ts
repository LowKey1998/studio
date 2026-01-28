
import { NextRequest, NextResponse } from 'next/server';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Issuer } from 'openid-client';

export async function GET(req: NextRequest) {
    try {
        const settingsRef = ref(db, 'settings/integrations/quickbooks');
        const snapshot = await get(settingsRef);

        if (!snapshot.exists()) {
            throw new Error("QuickBooks settings not found.");
        }

        const { clientId, clientSecret } = snapshot.val();
        
        if (!clientId || !clientSecret) {
            throw new Error("QuickBooks Client ID or Secret is not configured.");
        }

        const qboIssuer = await Issuer.discover('https://developer.api.intuit.com/.well-known/openid_configuration');

        const client = new qboIssuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: [`${process.env.NEXT_PUBLIC_BASE_URL}/api/quickbooks/callback`],
            response_types: ['code'],
        });

        const authUrl = client.authorizationUrl({
            scope: 'com.intuit.quickbooks.accounting openid profile email phone address',
        });

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('QuickBooks Auth Error:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
