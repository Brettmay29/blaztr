import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await req.json();
    if (!code) return Response.json({ error: 'No code provided' }, { status: 400 });

    const CLIENT_ID = '74188123197-1dhi733ml4cl831d28nic2uk9opdvkqu.apps.googleusercontent.com';
    const CLIENT_SECRET = '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';
    const REDIRECT_URI = 'https://blaztr.base44.app/OAuthCallback';

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      return Response.json({ error: 'Token exchange failed', details: err }, { status: 500 });
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token } = tokens;

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    const profile = await profileRes.json();
    const email = profile.email;
    const firstName = profile.given_name || '';
    const lastName = profile.family_name || '';

    const existing = await base44.asServiceRole.entities.GmailAccount.list();
    const alreadyExists = existing.find((a) => a.email === email);

    if (alreadyExists) {
      await base44.asServiceRole.entities.GmailAccount.update(alreadyExists.id, {
        access_token,
        refresh_token: refresh_token || alreadyExists.refresh_token,
        is_connected: true,
      });
      return Response.json({ success: true, email, updated: true });
    }

    await base44.asServiceRole.entities.GmailAccount.create({
      email,
      nickname: `${firstName} ${lastName}`.trim() || email.split('@')[0],
      first_name: firstName,
      last_name: lastName,
      access_token,
      refresh_token: refresh_token || '',
      is_connected: true,
      daily_limit: 30,
      sent_today: 0,
      signature: '',
    });

    return Response.json({ success: true, email, created: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});