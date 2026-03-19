import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
      const base44 = createClientFromRequest(req);

          const allLogs = await base44.asServiceRole.entities.SendLog.list('-created_date', 500);
              const campaigns = await base44.asServiceRole.entities.Campaign.list();

                  let updated = 0;

                      for (const campaign of campaigns) {
                            const campaignLogs = allLogs.filter(l => l.campaign_id === campaign.id);
                                  const sentCount = campaignLogs.filter(l =>
                                          l.status === 'Sent' || l.status === 'Opened' || l.status === 'Replied'
                                                ).length;
                                                      const replyCount = campaignLogs.filter(l => l.status === 'Replied').length;

                                                            await base44.asServiceRole.entities.Campaign.update(campaign.id, {
                                                                    total_sent: sentCount,
                                                                            total_replies: replyCount,
                                                                                  });

                                                                                        updated++;
                                                                                            }

                                                                                                const gmailAccounts = await base44.asServiceRole.entities.GmailAccount.list();
                                                                                                    const todayStr = new Date().toISOString().split('T')[0];
                                                                                                    
                                                                                                        for (const account of gmailAccounts) {
                                                                                                              const sentToday = allLogs.filter(l =>
                                                                                                                      l.gmail_account_id === account.id &&
                                                                                                                              l.sent_at &&
                                                                                                                                      l.sent_at.startsWith(todayStr)
                                                                                                                                            ).length;
                                                                                                                                            
                                                                                                                                                  await base44.asServiceRole.entities.GmailAccount.update(account.id, {
                                                                                                                                                          sent_today: sentToday,
                                                                                                                                                                });
                                                                                                                                                                    }
                                                                                                                                                                    
                                                                                                                                                                        return Response.json({
                                                                                                                                                                              message: `Fixed counters for ${updated} campaigns and ${gmailAccounts.length} Gmail accounts.`,
                                                                                                                                                                                    success: true,
                                                                                                                                                                                        });
                                                                                                                                                                                        
                                                                                                                                                                                          } catch (error) {
                                                                                                                                                                                              return Response.json({ error: error.message }, { status: 500 });
                                                                                                                                                                                                }
                                                                                                                                                                                                });
