import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all Gmail accounts and check each one
    const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();
    const allMessages = [];

    // Helper to properly decode base64url encoded email body as UTF-8
    const decodeBase64Utf8 = (data) => {
      try {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
      } catch {
        return '';
      }
    };

    for (const account of gmailAccounts) {
      let accessToken;
      if (account.access_token) {
        accessToken = account.access_token;
      } else {
        try {
          const conn = await base44.asServiceRole.connectors.getConnection('gmail');
          accessToken = conn.accessToken;
        } catch {
          continue;
        }
      }

      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=30',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!listRes.ok) continue;

      const listData = await listRes.json();
      const messages = listData.messages || [];

      const details = await Promise.all(
        messages.map(async (m) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!msgRes.ok) return null;
          const msg = await msgRes.json();

          const headers = msg.payload?.headers || [];
          const get = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          // Extract body with proper UTF-8 decoding
          let body = '';
          const extractBody = (parts) => {
            if (!parts) return;
            for (const part of parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                body = decodeBase64Utf8(part.body.data);
                return;
              }
              if (part.mimeType === 'text/html' && part.body?.data && !body) {
                // Fallback to HTML if no plain text
                const html = decodeBase64Utf8(part.body.data);
                // Strip HTML tags for display
                body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                return;
              }
              if (part.parts) extractBody(part.parts);
            }
          };

          if (msg.payload?.body?.data) {
            body = decodeBase64Utf8(msg.payload.body.data);
          } else {
            extractBody(msg.payload?.parts);
          }

          // Decode snippet UTF-8 entities
          const snippet = msg.snippet
            ? msg.snippet
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
            : '';

          return {
            id: msg.id,
            threadId: msg.threadId,
            from: get('From'),
            to: get('To') || account.email,
            subject: get('Subject'),
            date: get('Date'),
            snippet,
            body,
            isUnread: (msg.labelIds || []).includes('UNREAD'),
            account_email: account.email,
          };
        })
      );

      const validDetails = details.filter(Boolean);
      allMessages.push(...validDetails);
    }

    // Sort by date descending
    allMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({ messages: allMessages.slice(0, 50) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
