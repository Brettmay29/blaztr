import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { threadId, to, subject, body, gmail_account_id } = await req.json();
    if (!threadId || !to || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Token refresh helper
    const refreshAccessToken = async (refreshToken) => {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: '74188123197-1dhi733ml4cl831d28nic2uk9opdvkqu.apps.googleusercontent.com',
          client_secret: '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',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!refreshRes.ok) return null;
      const data = await refreshRes.json();
      return data.access_token || null;
    };

    // Get access token — use specific account if provided, otherwise fall back to connector
    let accessToken;
    let gmailAccountData = null;

    if (gmail_account_id) {
      try {
        gmailAccountData = await base44.asServiceRole.entities.GmailAccount.get(gmail_account_id);
        if (gmailAccountData?.access_token) {
          accessToken = gmailAccountData.access_token;
        }
      } catch { /* fall through to connector */ }
    }

    if (!accessToken) {
      try {
        const conn = await base44.asServiceRole.connectors.getConnection('gmail');
        accessToken = conn.accessToken;
      } catch (err) {
        return Response.json({ error: 'Failed to connect to Gmail.', details: err.message }, { status: 500 });
      }
    }

    const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject}`;
    const emailLines = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ];
    const raw = emailLines.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Try sending — if 401, refresh token and retry once
    let gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail, threadId }),
    });

    if (gmailRes.status === 401 && gmailAccountData?.refresh_token) {
      const newToken = await refreshAccessToken(gmailAccountData.refresh_token);
      if (newToken) {
        await base44.asServiceRole.entities.GmailAccount.update(gmail_account_id, {
          access_token: newToken,
        });
        accessToken = newToken;
        gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedEmail, threadId }),
        });
      }
    }

    if (!gmailRes.ok) {
      const err = await gmailRes.json();
      return Response.json({ error: 'Gmail send failed', details: err }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
