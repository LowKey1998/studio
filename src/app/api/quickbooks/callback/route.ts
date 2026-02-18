import { NextRequest, NextResponse } from 'next/server';
import { get, ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Issuer } from 'openid-client';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const settingsRef = ref(db, 'settings/integrations/quickbooks');
        const snapshot = await get(settingsRef);

        if (!snapshot.exists()) {
            throw new Error("QuickBooks settings not found.");
        }
        
        const { clientId, clientSecret } = snapshot.val();
        const qboIssuer = await Issuer.discover('https://developer.api.intuit.com/.well-known/openid_configuration');

        const client = new qboIssuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: [`${process.env.NEXT_PUBLIC_BASE_URL}/api/quickbooks/callback`],
            response_types: ['code'],
        });

        // Retrieve the state from the cookie for validation
        const cookieStore = await cookies();
        const state = cookieStore.get('qb_auth_state')?.value;

        const params = client.callbackParams(req.url);
        
        // Finalize the callback using the stored state
        const tokenSet = await client.callback(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/quickbooks/callback`, 
            params, 
            { state }
        );

        // Clear the state cookie
        cookieStore.delete('qb_auth_state');

        const realmId = params.realmId;
        const accessToken = tokenSet.access_token;
        const refreshToken = tokenSet.refresh_token;

        if (!realmId || !accessToken || !refreshToken) {
            throw new Error("Failed to retrieve necessary tokens from QuickBooks.");
        }
        
        // Securely store the tokens and realmId in your database
        await update(settingsRef, {
            accessToken,
            refreshToken,
            realmId,
            connected: true,
            tokenExpiry: new Date().getTime() + (tokenSet.expires_in! * 1000)
        });

        // Redirect user back to the integration dashboard
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/addons/quickbooks`);

    } catch (error: any) {
        console.error('QuickBooks Callback Error:', error);
        return new NextResponse(`Error during QuickBooks authentication: ${error.message}`, { status: 500 });
    }
}
