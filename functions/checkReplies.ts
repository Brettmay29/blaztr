import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all Gmail accounts
    const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();

    // Fetch all send logs to cross-reference
    const sendLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 500);
    const sentEmails = new Set(sendLogs.map((l) => l.lead_email?.toLowerCase()));

    const repliesFound = [];
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const query = `in:inbox after:${sevenDaysAgo}`;

    // Check each Gmail account's inbox
    for (const account of gmailAccounts) {
      // Get access token — use stored OAuth token or fall back to Base44 connector
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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listRes.ok) continue;

      const listData = await listRes.json();
      const messages = listData.messages || [];

      for (const msg of messages.slice(0, 20)) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
        const emailMatch = fromHeader.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        const fromEmail = emailMatch?.[0]?.toLowerCase();

        if (!fromEmail || !sentEmails.has(fromEmail)) continue;

        // Check if we already recorded this reply
        const alreadyReplied = sendLogs.some(
          (l) => l.lead_email?.toLowerCase() === fromEmail && l.status === 'Replied'
        );
        if (alreadyReplied) continue;

        repliesFound.push({ email: fromEmail, message_id: msg.id, account: account.email });

        // Find the most recent matching send log
        const matchingLog = sendLogs.find(
          (l) => l.lead_email?.toLowerCase() === fromEmail && l.status !== 'Replied'
        );

        if (matchingLog?.lead_id) {
          // Update lead status
          await base44.asServiceRole.entities.Lead.update(matchingLog.lead_id, {
            status: 'Replied',
            reply_sentiment: 'PR',
          });

          // Update send log
          await base44.asServiceRole.entities.SendLog.update(matchingLog.id, {
            status: 'Replied',
            replied_at: new Date().toISOString(),
          });

          // Update campaign reply count
          if (matchingLog.campaign_id) {
            const campaign = await base44.asServiceRole.entities.Campaign.get(matchingLog.campaign_id);
            if (campaign) {
              await base44.asServiceRole.entities.Campaign.update(matchingLog.campaign_id, {
                total_replies: (campaign.total_replies || 0) + 1,
              });
            }
          }
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