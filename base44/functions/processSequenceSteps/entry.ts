import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

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

    const inlineStyles = (html) => {
      return html
        .replace(/<p[^>]*><br\s*\/?><\/p>/gi, '<p style="margin:0;padding:0;line-height:1.4;font-family:Arial,sans-serif;font-size:14px;color:#333;">&nbsp;</p>')
        .replace(/<p(?:\s+style="[^"]*")?>/gi, '<p style="margin:0;padding:0;line-height:1.4;font-family:Arial,sans-serif;font-size:14px;color:#333;">')
        .replace(/<br\s*\/?>/gi, '<br style="display:block;content:\'\';margin-top:0;">');
    };

    const buildAndSendEmail = async (lead, step, gmailAccount, accessToken) => {
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

      const replaceVars = (text) => {
        if (!text) return '';
        return text.replace(/\{\{([^}]+)\}\}/gi, (match, varName) => {
          const key = varName.toLowerCase().replace(/\s+/g, '').trim();
          return variableMap[key] !== undefined ? variableMap[key] : match;
        });
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
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: buildRaw() }),
      });

      if (gmailRes.status === 401 && gmailAccount.refresh_token) {
        const newToken = await refreshAccessToken(gmailAccount.refresh_token);
        if (newToken) {
          await base44.asServiceRole.entities.GmailAccount.update(gmailAccount.id, { access_token: newToken });
          accessToken = newToken;
          gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: buildRaw() }),
          });
        }
      }

      return { ok: gmailRes.ok, subject: processedSubject, accessToken };
    };

    // ── Load all data ─────────────────────────────────────────────────────────

    const sequences = await base44.asServiceRole.entities.Sequence.list();
    const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();
    const campaigns = await base44.asServiceRole.entities.Campaign.list();
    const allLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 500);

    // ── GLOBAL DEDUP SET — no lead gets emailed twice in one day ──────────────
    const emailsSentToday = new Set(
      allLogs
        .filter(l => l.sent_at && l.sent_at.startsWith(todayStr))
        .map(l => l.lead_email)
        .filter(Boolean)
    );

    // ── SAFETY FLOOR: max 1 email per Gmail account per cron run ─────────────
    // This is the absolute hard limit — no matter what settings are configured,
    // we never send more than 1 email per Gmail account per 5-minute cron cycle.
    // This protects inboxes from bulk sending and spam flags.
    const gmailAccountSentThisRun = new Set();

    let step1Processed = 0;
    let step1Failed = 0;

    // ── PART 1: Send Step 1 for Active campaigns ──────────────────────────────

    const activeCampaigns = campaigns.filter((c) => c.status === 'Active' && c.leads_group_id);

    for (const campaign of activeCampaigns) {
      try {
        const sequence = sequences.find((s) => s.id === campaign.sequence_id);
        if (!sequence?.steps?.[0]) continue;

        const gmailAccount = gmailAccounts.find((a) => a.id === campaign.gmail_account_id);
        if (!gmailAccount) continue;

        // SAFETY FLOOR: skip if this Gmail account already sent in this cron run
        if (gmailAccountSentThisRun.has(gmailAccount.id)) continue;

        // Check daily limit for this Gmail account
        const sentTodayByAccount = allLogs.filter((l) =>
          l.gmail_account_id === campaign.gmail_account_id &&
          l.sent_at &&
          l.sent_at.startsWith(todayStr)
        ).length;

        const dailyLimit = campaign.daily_limit || gmailAccount.daily_limit || 30;
        const remainingToday = dailyLimit - sentTodayByAccount;
        if (remainingToday <= 0) continue;

        const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
        const eligibleLeads = allLeads.filter((l) =>
          l.group_id === campaign.leads_group_id &&
          (l.status === 'New' || l.status === 'Pending') &&
          !['Replied', 'Bounced', 'Opted Out', 'Undeliverable', 'Contacted'].includes(l.status) &&
          !emailsSentToday.has(l.email)
        ).slice(0, 1); // Always exactly 1 per campaign per cron run

        if (eligibleLeads.length === 0) continue;

        let accessToken = gmailAccount.access_token;
        if (!accessToken) {
          try {
            const conn = await base44.asServiceRole.connectors.getConnection('gmail');
            accessToken = conn.accessToken;
          } catch {
            step1Failed++;
            continue;
          }
        }

        const firstStep = sequence.steps[0];
        const secondStep = sequence.steps[1] || null;
        const lead = eligibleLeads[0];

        try {
          const result = await buildAndSendEmail(lead, firstStep, gmailAccount, accessToken);
          accessToken = result.accessToken;

          if (!result.ok) {
            step1Failed++;
            continue;
          }

          // Mark this Gmail account as used for this cron run
          gmailAccountSentThisRun.add(gmailAccount.id);
          emailsSentToday.add(lead.email);

          let nextSendAt = null;
          if (secondStep) {
            const delayMs = ((secondStep.delay_days || 0) * 24 * 60 * 60 * 1000) +
                            ((secondStep.delay_hours || 0) * 60 * 60 * 1000) +
                            ((secondStep.delay_minutes || 0) * 60 * 1000);
            nextSendAt = new Date(Date.now() + delayMs).toISOString();
          }

          const nowIso = new Date().toISOString();

          await base44.asServiceRole.entities.SendLog.create({
            lead_id: lead.id,
            campaign_id: campaign.id,
            gmail_account_id: campaign.gmail_account_id || '',
            status: 'Sent',
            sent_at: nowIso,
            lead_email: lead.email,
            lead_name: lead.first_name || '',
            subject: result.subject,
            sequence_step: 'Step 1',
            next_step_index: secondStep ? 1 : 0,
            next_send_at: nextSendAt || '',
          });

          await base44.asServiceRole.entities.Lead.update(lead.id, {
            status: 'Contacted',
            total_sends: (lead.total_sends || 0) + 1,
            latest_send: todayStr,
            next_send_at: nextSendAt || '',
          });

          await base44.asServiceRole.entities.Campaign.update(campaign.id, {
            total_sent: (campaign.total_sent || 0) + 1,
          });

          step1Processed++;
        } catch (err) {
          console.error('Step 1 error for lead', lead.id, err.message);
          step1Failed++;
        }
      } catch (err) {
        console.error('Error processing campaign', campaign.id, err.message);
      }
    }

    // ── PART 2: Follow-ups (Steps 2, 3, 4, etc.) ─────────────────────────────

    const allPendingLogs = allLogs.filter((log) => {
      if (!log.next_send_at || !log.next_step_index) return false;
      const sendAt = new Date(log.next_send_at);
      return sendAt <= now && log.status === 'Sent';
    });

    // SAFETY FLOOR: only 1 follow-up per Gmail account per cron run
    const pendingLogs = allPendingLogs.filter((log) => {
      const campaign = campaigns.find((c) => c.id === log.campaign_id);
      if (!campaign) return false;
      const gmailAccountId = campaign.gmail_account_id;
      if (gmailAccountSentThisRun.has(gmailAccountId)) return false;
      gmailAccountSentThisRun.add(gmailAccountId);
      return true;
    });

    let followUpProcessed = 0;
    let followUpFailed = 0;

    for (const log of pendingLogs) {
      try {
        const campaign = campaigns.find((c) => c.id === log.campaign_id);
        if (!campaign) continue;
        if (campaign.status === 'Paused' || campaign.status === 'Completed') continue;

        const sequence = sequences.find((s) => s.id === campaign.sequence_id);
        if (!sequence) continue;

        const stepIndex = log.next_step_index;
        const step = sequence.steps?.[stepIndex];
        if (!step) continue;

        const lead = await base44.asServiceRole.entities.Lead.get(log.lead_id);
        if (!lead) continue;
        if (['Replied', 'Opted Out', 'Bounced', 'Undeliverable'].includes(lead.status)) continue;

        const gmailAccount = gmailAccounts.find((a) => a.id === campaign.gmail_account_id);
        if (!gmailAccount) continue;

        let accessToken = gmailAccount.access_token;
        if (!accessToken) {
          try {
            const conn = await base44.asServiceRole.connectors.getConnection('gmail');
            accessToken = conn.accessToken;
          } catch {
            followUpFailed++;
            continue;
          }
        }

        const result = await buildAndSendEmail(lead, step, gmailAccount, accessToken);

        if (!result.ok) {
          followUpFailed++;
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

        const nowIso = new Date().toISOString();

        await base44.asServiceRole.entities.SendLog.create({
          lead_id: log.lead_id,
          campaign_id: log.campaign_id,
          gmail_account_id: campaign.gmail_account_id || '',
          status: 'Sent',
          sent_at: nowIso,
          lead_email: lead.email,
          lead_name: lead.first_name || '',
          subject: result.subject,
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
          latest_send: todayStr,
          next_send_at: nextSendAt || '',
        });

        followUpProcessed++;
      } catch (err) {
        console.error('Follow-up error:', log.id, err.message);
        followUpFailed++;
      }
    }

    return Response.json({
      step1_processed: step1Processed,
      step1_failed: step1Failed,
      followups_processed: followUpProcessed,
      followups_failed: followUpFailed,
      message: `Step 1: ${step1Processed} sent. Follow-ups: ${followUpProcessed} sent.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});