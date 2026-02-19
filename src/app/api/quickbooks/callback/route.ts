import { NextRequest, NextResponse } from 'next/server';
import { get, ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Issuer } from 'openid-client';
import { cookies } from 'next/headers';

/**
 * Handles the redirect back from QuickBooks.
 * Verifies the 'state' parameter against the stored cookie and exchanges the code for tokens.
 */
export async function GET(req: NextRequest) {
    try {
        const settingsRef = ref(db, 'settings/integrations/quickbooks');
        const snapshot = await get(settingsRef);

        if (!snapshot.exists()) {
            throw new Error("QuickBooks settings not found.");
        }
        
        const { clientId, clientSecret } = snapshot.val();
        
        // 1. Get the issuer and initialize client
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

        // 2. Retrieve and verify the state from the cookie
        const cookieStore = await cookies();
        const storedState = cookieStore.get('qb_oauth_state')?.value;
        
        if (!storedState) {
            throw new Error("Missing OAuth state cookie. The request may have timed out or been intercepted.");
        }

        const params = client.callbackParams(req.url);
        
        // 3. Finalize the token exchange using the stored state
        const tokenSet = await client.callback(
            redirectUri, 
            params, 
            { state: storedState }
        );

        // 4. Clear the state cookie now that it's verified
        cookieStore.delete('qb_oauth_state');

        const realmId = params.realmId;
        const accessToken = tokenSet.access_token;
        const refreshToken = tokenSet.refresh_token;

        if (!realmId || !accessToken || !refreshToken) {
            throw new Error("QuickBooks did not return valid tokens.");
        }
        
        // 5. Update the database with the real production tokens
        await update(settingsRef, {
            accessToken,
            refreshToken,
            realmId,
            connected: true,
            tokenExpiry: new Date().getTime() + (tokenSet.expires_in! * 1000)
        });

        // 6. Redirect back to the UI
        return NextResponse.redirect(`${baseUrl}/admin/addons/quickbooks`);

    } catch (error: any) {
        console.error('QuickBooks Callback Handler Error:', error);
        return new NextResponse(`Authentication Callback Error: ${error.message}`, { status: 500 });
    }
}
