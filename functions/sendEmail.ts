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

    // Fetch gmail account data for variable replacement (required for sender info)
    let gmailAccountData = null;
    let leadData = null;

    // Gmail account is required
    if (!gmail_account_id) {
      return Response.json({ error: 'gmail_account_id is required' }, { status: 400 });
    }

    try {
      gmailAccountData = await base44.asServiceRole.entities.GmailAccount.get(gmail_account_id);
    } catch (err) {
      return Response.json({ error: `Failed to fetch Gmail account (ID: ${gmail_account_id}): ${err.message}` }, { status: 400 });
    }

    // Lead data is optional
    if (lead_id) {
      try {
        leadData = await base44.asServiceRole.entities.Lead.get(lead_id);
      } catch {
        // Lead not found, continue with defaults
      }
    }

    // Build lead data (use actual lead if available, fallback to defaults)
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

    // Build sender data from Gmail account (always use actual account data)
    const sampleSender = {
      first_name: gmailAccountData.first_name || '',
      last_name: gmailAccountData.last_name || '',
      signature: gmailAccountData.signature || '',
    };

    // Strip HTML tags
    const stripHTML = (text) => {
      if (!text) return text;
      return text
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<div>/g, '')
        .replace(/<\/div>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    };

    // Replace variables (case-insensitive)
    const replaceVariables = (text) => {
      if (!text) return text;
      let result = text;

      // Lead variables
      result = result.replace(/\{\{firstName\}\}/gi, sampleLead.first_name);
      result = result.replace(/\{\{lastName\}\}/gi, sampleLead.last_name);
      result = result.replace(/\{\{email\}\}/gi, sampleLead.email);
      result = result.replace(/\{\{companyName\}\}/gi, sampleLead.company_name);
      result = result.replace(/\{\{companyWebsite\}\}/gi, sampleLead.company_website);
      result = result.replace(/\{\{industry\}\}/gi, sampleLead.industry);
      result = result.replace(/\{\{state\}\}/gi, sampleLead.state);
      result = result.replace(/\{\{market\}\}/gi, sampleLead.market);

      // Sender variables
      result = result.replace(/\{\{senderFirstName\}\}/gi, sampleSender.first_name);
      result = result.replace(/\{\{senderLastName\}\}/gi, sampleSender.last_name);
      // Clean signature HTML before injecting
      const cleanedSignature = stripHTML(sampleSender.signature);
      result = result.replace(/\{\{senderSignature\}\}/gi, '\n' + cleanedSignature);

      return result;
    };

    const processedSubject = replaceVariables(subject);
    let processedBody = replaceVariables(body);
    processedBody = stripHTML(processedBody);
    
    // Debug log
    console.log('=== EMAIL SEND DEBUG ===');
    console.log('From Gmail Account:', gmailAccountData.email, '(' + gmailAccountData.nickname + ')');
    console.log('Sender Data:', { first_name: sampleSender.first_name, last_name: sampleSender.last_name });
    if (leadData) {
      console.log('Lead Data:', { first_name: sampleLead.first_name, company: sampleLead.company_name });
    } else {
      console.log('Lead Data: None (using defaults)');
    }
    console.log('---');
    console.log('Original subject:', subject);
    console.log('Subject after replace:', processedSubject);
    console.log('---');
    console.log('Original body (first 150 chars):', body?.substring(0, 150));
    console.log('After variable replace (first 150 chars):', replaceVariables(body)?.substring(0, 150));
    console.log('After HTML strip (final, first 150 chars):', processedBody?.substring(0, 150));
    console.log('=== END DEBUG ===');

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