import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();
    const sendLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 500);
    const sentEmails = new Set(sendLogs.map((l) => l.lead_email?.toLowerCase()));

    const repliesFound = [];
    const bouncesFound = [];
    const processedEmails = new Set();
    const processedBounces = new Set();
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const query = `in:inbox after:${sevenDaysAgo}`;

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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!listRes.ok) continue;

      const listData = await listRes.json();
      const messages = listData.messages || [];

      for (const msg of messages.slice(0, 30)) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name === 'From')?.value || '';
        const emailReceivedAt = parseInt(msgData.internalDate || '0');

        // ── BOUNCE DETECTION ──
        const isBounceSender =
          fromHeader.toLowerCase().includes('mailer-daemon') ||
          fromHeader.toLowerCase().includes('postmaster');

        if (isBounceSender) {
          // Extract bounced email from message body
          const bodyParts = msgData.payload?.parts || [msgData.payload];
          let bodyText = '';
          for (const part of bodyParts) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
            // Check nested parts
            if (part?.parts) {
              for (const subpart of part.parts) {
                if (subpart?.mimeType === 'text/plain' && subpart?.body?.data) {
                  bodyText += atob(subpart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                }
              }
            }
          }

          // Extract Final-Recipient email
          const finalRecipientMatch = bodyText.match(/Final-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i);
          const bouncedEmail = finalRecipientMatch?.[1]?.toLowerCase().trim();

          if (bouncedEmail && sentEmails.has(bouncedEmail) && !processedBounces.has(bouncedEmail)) {
            processedBounces.add(bouncedEmail);

            // Find matching lead
            const matchingLog = sendLogs.find(
              (l) => l.lead_email?.toLowerCase() === bouncedEmail
            );

            if (matchingLog?.lead_id) {
              // Check if already marked undeliverable
              const lead = await base44.asServiceRole.entities.Lead.get(matchingLog.lead_id);
              if (lead && lead.status !== 'Undeliverable') {
                // Mark lead as Undeliverable — quarantined from future sends
                await base44.asServiceRole.entities.Lead.update(matchingLog.lead_id, {
                  status: 'Bounced',
                });

                // Update send log status
                await base44.asServiceRole.entities.SendLog.update(matchingLog.id, {
                  status: 'Failed',
                });

                bouncesFound.push({ email: bouncedEmail, account: account.email });
              }
            }
          }
          continue; // Skip reply processing for bounce emails
        }

        // ── REPLY DETECTION ──
        const emailMatch = fromHeader.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        const fromEmail = emailMatch?.[0]?.toLowerCase();

        if (!fromEmail || !sentEmails.has(fromEmail)) continue;
        if (processedEmails.has(fromEmail)) continue;

        const matchingLog = sendLogs
          .filter((l) => {
            if (l.lead_email?.toLowerCase() !== fromEmail) return false;
            if (l.status === 'Replied') return false;
            if (!l.sent_at) return false;
            const sentAtMs = new Date(l.sent_at).getTime();
            return emailReceivedAt > sentAtMs;
          })
          .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

        if (!matchingLog) continue;

        const alreadyReplied = sendLogs.some(
          (l) => l.lead_email?.toLowerCase() === fromEmail && l.status === 'Replied'
        );
        if (alreadyReplied) continue;

        processedEmails.add(fromEmail);
        repliesFound.push({ email: fromEmail, message_id: msg.id, account: account.email });

        if (matchingLog?.lead_id) {
          await base44.asServiceRole.entities.Lead.update(matchingLog.lead_id, {
            status: 'Replied',
            reply_sentiment: 'PR',
          });

          await base44.asServiceRole.entities.SendLog.update(matchingLog.id, {
            status: 'Replied',
            replied_at: new Date().toISOString(),
          });

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
      bounces_found: bouncesFound.length,
      replies: repliesFound,
      bounces: bouncesFound,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
