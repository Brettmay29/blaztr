import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, subject, body, lead_id, campaign_id, gmail_account_id, sequence_step } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    if (!gmail_account_id) {
      return Response.json({ error: 'gmail_account_id is required' }, { status: 400 });
    }

    let gmailAccountData = null;
    let leadData = null;

    try {
      gmailAccountData = await base44.asServiceRole.entities.GmailAccount.get(gmail_account_id);
    } catch (err) {
      return Response.json({ error: `Failed to fetch Gmail account: ${err.message}` }, { status: 400 });
    }

    if (lead_id) {
      try {
        leadData = await base44.asServiceRole.entities.Lead.get(lead_id);
      } catch {
        // Lead not found, continue with defaults
      }
    }

    const sampleLead = {
      first_name: leadData?.first_name || 'John',
      last_name: leadData?.last_name || 'Doe',
      email: leadData?.email || 'john@example.com',
      company_name: leadData?.company_name || 'Acme Corp',
      company_website: leadData?.company_website || 'acme.com',
      industry: leadData?.industry || 'Technology',
      state: leadData?.state || 'NY',
      market: leadData?.market || 'Enterprise',
    };

    const sampleSender = {
      first_name: gmailAccountData.first_name || '',
      last_name: gmailAccountData.last_name || '',
      signature: gmailAccountData.signature || '',
    };

    const variableMap = {
      firstname: sampleLead.first_name,
      lastname: sampleLead.last_name,
      email: sampleLead.email,
      companyname: sampleLead.company_name,
      companywebsite: sampleLead.company_website,
      industry: sampleLead.industry,
      state: sampleLead.state,
      market: sampleLead.market,
      senderfirstname: sampleSender.first_name,
      senderlastname: sampleSender.last_name,
      sendersignature: sampleSender.signature || '',
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

    const decodedSubject = decodeForVars(subject);
    const decodedBody    = decodeForVars(body);
    const processedSubject = replaceVars(decodedSubject);
    const processedBody    = replaceVars(decodedBody);

    // FINAL 1:1 PREVIEW → GMAIL MATCH (added <style> for p margins + doctype)
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title></title>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
p { margin: 0 0 1em 0; }
</style>
</head>
<body>
${processedBody}
</body>
</html>`;

    console.log('=== FINAL PROCESSED HTML EMAIL (pre-Gmail send) ===');
    console.log('SUBJECT:', processedSubject);
    console.log('BODY (HTML):', htmlContent);
    console.log('==============================================');

    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
    } catch (err) {
      return Response.json({ error: 'Failed to connect to Gmail. Please authorize the Gmail connector in settings.', details: err.message }, { status: 500 });
    }

    const emailLines = [
      `To: ${to}`,
      `Subject: ${processedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
    ];
    const raw = emailLines.join('\r\n') + '\r\n\r\n' + htmlContent;

    const encodedEmail = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!gmailRes.ok) {
      const err = await gmailRes.json();
      return Response.json({ error: 'Gmail send failed', details: err }, { status: 500 });
    }

    const gmailData = await gmailRes.json();
    const now = new Date().toISOString();
    const nowDate = now.split('T')[0];
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (lead_id) {
      const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
      await base44.asServiceRole.entities.Lead.update(lead_id, {
        status: 'Sent',
        latest_send: nowDate,
        total_sends: (lead?.total_sends || 0) + 1,
        next_send: threeDaysLater,
        sender_email: '',
        sequence_type: sequence_step || '1st',
      });
    }

    if (lead_id && campaign_id) {
      const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
      await base44.asServiceRole.entities.SendLog.create({
        lead_id,
        campaign_id,
        gmail_account_id: gmail_account_id || '',
        status: 'Sent',
        sent_at: now,
        lead_email: to,
        lead_name: lead?.first_name || '',
        subject: processedSubject,
        sequence_step: sequence_step || '1st',
      });
    }

    return Response.json({ success: true, message_id: gmailData.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});