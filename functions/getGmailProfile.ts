import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Get Gmail profile (email address of connected account)
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const err = await profileRes.json();
      return Response.json({ error: 'Failed to fetch Gmail profile', details: err }, { status: 500 });
    }

    const profile = await profileRes.json();

    return Response.json({
      email: profile.emailAddress,
      messages_total: profile.messagesTotal,
      threads_total: profile.threadsTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});