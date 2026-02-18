import { NextRequest, NextResponse } from 'next/server';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Issuer, generators } from 'openid-client';
import { cookies } from 'next/headers';

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

        // Generate a random state for CSRF protection
        const state = generators.state();
        
        // Store the state in a cookie to verify it in the callback
        const cookieStore = await cookies();
        cookieStore.set('qb_auth_state', state, { 
            maxAge: 60 * 10, // 10 minutes
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax'
        });

        const authUrl = client.authorizationUrl({
            scope: 'com.intuit.quickbooks.accounting openid profile email phone address',
            state,
        });

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('QuickBooks Auth Error:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
