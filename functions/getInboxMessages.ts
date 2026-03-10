import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Fetch last 30 messages from inbox
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=30',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];

    // Fetch each message's details in parallel
    const details = await Promise.all(
      messages.map(async (m) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msg = await msgRes.json();

        const headers = msg.payload?.headers || [];
        const get = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract body
        let body = '';
        const extractBody = (parts) => {
          if (!parts) return;
          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              return;
            }
            if (part.parts) extractBody(part.parts);
          }
        };
        if (msg.payload?.body?.data) {
          body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else {
          extractBody(msg.payload?.parts);
        }

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: get('From'),
          to: get('To'),
          subject: get('Subject'),
          date: get('Date'),
          snippet: msg.snippet,
          body,
          isUnread: (msg.labelIds || []).includes('UNREAD'),
        };
      })
    );

    return Response.json({ messages: details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});