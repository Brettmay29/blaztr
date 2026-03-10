import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Search inbox for replies (messages in INBOX not sent by us, last 7 days)
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const query = `in:inbox after:${sevenDaysAgo}`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.json();
      return Response.json({ error: 'Failed to list messages', details: err }, { status: 500 });
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    // Fetch all send logs to cross-reference
    const sendLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 200);
    const sentEmails = new Set(sendLogs.map((l) => l.lead_email?.toLowerCase()));

    const repliesFound = [];

    for (const msg of messages.slice(0, 20)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
      const emailMatch = fromHeader.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      const fromEmail = emailMatch?.[0]?.toLowerCase();

      if (fromEmail && sentEmails.has(fromEmail)) {
        repliesFound.push({ email: fromEmail, message_id: msg.id });

        // Find matching lead and update reply_sentiment
        const matchingLog = sendLogs.find((l) => l.lead_email?.toLowerCase() === fromEmail);
        if (matchingLog?.lead_id) {
          await base44.asServiceRole.entities.Lead.update(matchingLog.lead_id, {
            reply_sentiment: 'PR',
            status: 'Replied',
          });
          await base44.asServiceRole.entities.SendLog.update(matchingLog.id, {
            status: 'Replied',
            replied_at: new Date().toISOString(),
          });
        }
      }
    }

    return Response.json({
      replies_found: repliesFound.length,
      replies: repliesFound,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});