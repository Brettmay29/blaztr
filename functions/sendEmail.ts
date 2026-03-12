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

    // Fetch lead and gmail account data for variable replacement
    let leadData = null;
    let gmailAccountData = null;

    if (lead_id) {
      try {
        leadData = await base44.asServiceRole.entities.Lead.get(lead_id);
      } catch {
        // Lead not found, use defaults
      }
    }

    if (gmail_account_id) {
      try {
        gmailAccountData = await base44.asServiceRole.entities.GmailAccount.get(gmail_account_id);
      } catch {
        // Account not found, use defaults
      }
    }

    // Sample data for testing
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
      first_name: gmailAccountData?.first_name || 'Brett',
      last_name: gmailAccountData?.last_name || 'Smith',
      signature: gmailAccountData?.signature || '',
    };

    // Replace variables in subject and body
    const replaceVariables = (text) => {
      if (!text) return text;
      let result = text;
      
      // Lead variables
      result = result.replace(/\{\{firstName\}\}/g, sampleLead.first_name);
      result = result.replace(/\{\{lastName\}\}/g, sampleLead.last_name);
      result = result.replace(/\{\{email\}\}/g, sampleLead.email);
      result = result.replace(/\{\{companyName\}\}/g, sampleLead.company_name);
      result = result.replace(/\{\{companyWebsite\}\}/g, sampleLead.company_website);
      result = result.replace(/\{\{industry\}\}/g, sampleLead.industry);
      result = result.replace(/\{\{state\}\}/g, sampleLead.state);
      result = result.replace(/\{\{market\}\}/g, sampleLead.market);

      // Sender variables
      result = result.replace(/\{\{senderFirstName\}\}/g, sampleSender.first_name);
      result = result.replace(/\{\{senderLastName\}\}/g, sampleSender.last_name);
      result = result.replace(/\{\{senderSignature\}\}/g, sampleSender.signature);

      return result;
    };

    const processedSubject = replaceVariables(subject);
    let processedBody = replaceVariables(body);
    
    // Strip HTML tags and convert to plain text
    processedBody = processedBody
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
    } catch (err) {
      return Response.json({ error: 'Failed to connect to Gmail. Please authorize the Gmail connector in settings.', details: err.message }, { status: 500 });
    }

    // Build RFC 2822 email
    const emailLines = [
      `To: ${to}`,
      `Subject: ${processedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
    ];
    const headers = emailLines.join('\r\n');
    const raw = headers + '\r\n\r\n' + processedBody;
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

    // Update lead record
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

    // Create send log
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