import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    const allLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 500);
    const pendingLogs = allLogs.filter((log) => {
      if (!log.next_send_at || !log.next_step_index) return false;
      const sendAt = new Date(log.next_send_at);
      return sendAt <= now && log.status === 'Sent';
    });

    if (pendingLogs.length === 0) {
      return Response.json({ processed: 0, message: 'No pending follow-ups due yet.' });
    }

    const sequences = await base44.asServiceRole.entities.Sequence.list();
    const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();
    const campaigns = await base44.asServiceRole.entities.Campaign.list();

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

    let processedCount = 0;
    let failCount = 0;

    for (const log of pendingLogs) {
      try {
        const campaign = campaigns.find((c) => c.id === log.campaign_id);
        if (!campaign) continue;

        // Skip if campaign is Paused or Completed
        if (campaign.status === 'Paused' || campaign.status === 'Completed') continue;

        const sequence = sequences.find((s) => s.id === campaign.sequence_id);
        if (!sequence) continue;

        const stepIndex = log.next_step_index;
        const step = sequence.steps?.[stepIndex];
        if (!step) continue;

        const lead = await base44.asServiceRole.entities.Lead.get(log.lead_id);
        if (!lead) continue;

        if (lead.status === 'Replied' || lead.status === 'Opted Out' || lead.status === 'Bounced' || lead.status === 'Undeliverable') continue;

        const gmailAccount = gmailAccounts.find((a) => a.id === campaign.gmail_account_id);
        if (!gmailAccount) continue;

        let accessToken;
        if (gmailAccount.access_token) {
          accessToken = gmailAccount.access_token;
        } else {
          try {
            const conn = await base44.asServiceRole.connectors.getConnection('gmail');
            accessToken = conn.accessToken;
          } catch {
            failCount++;
            continue;
          }
        }

        const variableMap = {
          firstname: lead.first_name || 'there',
          lastname: lead.last_name || '',
          email: lead.email || '',
          companyname: lead.company_name || '',
          companywebsite: lead.company_website || '',
          industry: lead.industry || '',
          state: lead.state || '',
          market: lead.market || '',
          senderfirstname: gmailAccount.first_name || '',
          senderlastname: gmailAccount.last_name || '',
          sendersignature: gmailAccount.signature || '',
          senderemail: gmailAccount.email || '',
        };

        const decodeForVars = (input) => {
          if (!input) return '';
          let s = String(input);
          s = s.replace(/&nbsp;/g, ' ')
               .replace(/&#160;/g, ' ')
               .replace(/&lcub;/g, '{').replace(/&rcub;/g, '}')
               .replace(/&#123;/g, '{').replace(/&#125;/g, '}')
               .replace(/&lbrace;/g, '{').replace(/&rbrace;/g, '}');
          return s;
        };

        const replaceVars = (text) => {
          if (!text) return '';
          return text.replace(/\{\{([^}]+)\}\}/gi, (match, varName) => {
            const key = varName.toLowerCase().replace(/\s+/g, '').trim();
            return variableMap[key] !== undefined ? variableMap[key] : match;
          });
        };

        const inlineStyles = (html) => {
          return html
            .replace(/<p[^>]*><br\s*\/?><\/p>/gi, '<p style="margin:0;padding:0;line-height:1.4;font-family:Arial,sans-serif;font-size:14px;color:#333;">&nbsp;</p>')
            .replace(/<p(?:\s+style="[^"]*")?>/gi, '<p style="margin:0;padding:0;line-height:1.4;font-family:Arial,sans-serif;font-size:14px;color:#333;">')
            .replace(/<br\s*\/?>/gi, '<br style="display:block;content:\'\';margin-top:0;">');
        };

        const processedSubject = replaceVars(decodeForVars(step.subject));
        const processedBody = inlineStyles(replaceVars(decodeForVars(step.body)));

        const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4;color:#333;margin:0;padding:20px;">
${processedBody}
</body>
</html>`;

        const senderName = `${gmailAccount.first_name || ''} ${gmailAccount.last_name || ''}`.trim();
        const fromHeader = senderName ? `${senderName} <${gmailAccount.email}>` : gmailAccount.email;

        const buildRaw = () => {
          const emailLines = [
            `To: ${lead.email}`,
            `From: ${fromHeader}`,
            `Subject: ${processedSubject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
          ];
          const raw = emailLines.join('\r\n') + '\r\n\r\n' + htmlContent;
          return btoa(unescape(encodeURIComponent(raw)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        };

        let gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: buildRaw() }),
        });

        if (gmailRes.status === 401 && gmailAccount.refresh_token) {
          const newToken = await refreshAccessToken(gmailAccount.refresh_token);
          if (newToken) {
            await base44.asServiceRole.entities.GmailAccount.update(gmailAccount.id, {
              access_token: newToken,
            });
            accessToken = newToken;
            gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${newToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ raw: buildRaw() }),
            });
          }
        }

        if (!gmailRes.ok) {
          failCount++;
          continue;
        }

        const nextStepIndex = stepIndex + 1;
        const nextStep = sequence.steps?.[nextStepIndex];
        let nextSendAt = null;
        if (nextStep) {
          const delayMs = ((nextStep.delay_days || 0) * 24 * 60 * 60 * 1000) +
                          ((nextStep.delay_hours || 0) * 60 * 60 * 1000) +
                          ((nextStep.delay_minutes || 0) * 60 * 1000);
          nextSendAt = new Date(Date.now() + delayMs).toISOString();
        }

        const now2 = new Date().toISOString();
        const nowDate = now2.split('T')[0];

        await base44.asServiceRole.entities.SendLog.create({
          lead_id: log.lead_id,
          campaign_id: log.campaign_id,
          gmail_account_id: campaign.gmail_account_id || '',
          status: 'Sent',
          sent_at: now2,
          lead_email: lead.email,
          lead_name: lead.first_name || '',
          subject: processedSubject,
          sequence_step: `Step ${stepIndex + 1}`,
          next_step_index: nextStep ? nextStepIndex + 1 : 0,
          next_send_at: nextSendAt || '',
        });

        await base44.asServiceRole.entities.SendLog.update(log.id, {
          next_step_index: 0,
          next_send_at: '',
        });

        await base44.asServiceRole.entities.Lead.update(log.lead_id, {
          total_sends: (lead.total_sends || 0) + 1,
          latest_send: nowDate,
          next_send_at: nextSendAt || '',
        });

        processedCount++;
      } catch (err) {
        console.error('Error processing log:', log.id, err.message);
        failCount++;
      }
    }

    return Response.json({
      processed: processedCount,
      failed: failCount,
      message: `Processed ${processedCount} follow-up emails${failCount > 0 ? `, ${failCount} failed` : ''}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
