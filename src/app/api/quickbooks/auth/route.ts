import { NextRequest, NextResponse } from 'next/server';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Issuer, generators } from 'openid-client';
import { cookies } from 'next/headers';

/**
 * Initiates the QuickBooks OAuth2 flow.
 * Generates a secure 'state' parameter and stores it in a cookie for validation in the callback.
 */
export async function GET(req: NextRequest) {
    try {
        const settingsRef = ref(db, 'settings/integrations/quickbooks');
        const snapshot = await get(settingsRef);

        if (!snapshot.exists()) {
            throw new Error("QuickBooks settings not found in database.");
        }

        const { clientId, clientSecret } = snapshot.val();
        
        if (!clientId || !clientSecret) {
            throw new Error("QuickBooks Client ID or Secret is not configured in settings.");
        }

        // 1. Discover the QuickBooks OpenID configuration
        const qboIssuer = await Issuer.discover('https://developer.api.intuit.com/.well-known/openid_configuration');

        // Dynamically determine the base URL from the request origin
        const baseUrl = req.nextUrl.origin;
        const redirectUri = `${baseUrl}/api/quickbooks/callback`;

        const client = new qboIssuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: [redirectUri],
            response_types: ['code'],
        });

        // 2. Generate secure state for CSRF protection
        const state = generators.state();
        
        // 3. Store state in an HTTP-only cookie for the callback route to verify
        const cookieStore = await cookies();
        cookieStore.set('qb_oauth_state', state, { 
            maxAge: 60 * 15, // 15 minutes
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production' || baseUrl.startsWith('https'),
            path: '/',
            sameSite: 'lax'
        });

        // 4. Generate the authorization URL
        const authUrl = client.authorizationUrl({
            scope: 'com.intuit.quickbooks.accounting openid profile email phone address',
            state,
        });

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('QuickBooks Authorization Error:', error);
        return new NextResponse(`Authorization Setup Error: ${error.message}`, { status: 500 });
    }
}
