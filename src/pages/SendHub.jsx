import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Rocket, Send, Loader2, CheckCircle, AlertCircle, Clock, Eye, MessageSquare, RefreshCw, CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SendHub() {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedGmail, setSelectedGmail] = useState("");
  const [selectedLeadGroup, setSelectedLeadGroup] = useState("");
  const [selectedFilterCampaign, setSelectedFilterCampaign] = useState("");
  const [sending, setSending] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [processingFollowUps, setProcessingFollowUps] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list(),
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: sendLogs = [] } = useQuery({
    queryKey: ["send_logs"],
    queryFn: () => base44.entities.SendLog.list("-created_date", 200),
  });

  const { data: leadsGroups = [] } = useQuery({
    queryKey: ["leadsGroups"],
    queryFn: () => base44.entities.LeadsGroup.list("-created_date", 100),
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => base44.entities.Sequence.list(),
  });

  const selectedLeads = selectedLeadGroup
    ? leads.filter((l) => l.group_id === selectedLeadGroup && (l.status === "New" || l.status === "Pending"))
    : leads.filter((l) => l.status === "New" || l.status === "Pending");

  const filteredSendLogs = selectedFilterCampaign
    ? sendLogs.filter((log) => log.campaign_id === selectedFilterCampaign)
    : sendLogs;

  const now = new Date();
  const pendingFollowUps = sendLogs.filter((log) => {
    if (!log.next_send_at || !log.next_step_index) return false;
    return new Date(log.next_send_at) <= now && log.status === 'Sent';
  }).length;

  const handleStartCampaign = async () => {
    if (!selectedCampaign || !selectedGmail || !selectedLeadGroup) return;
    setSending(true);

    const campaign = campaigns.find((c) => c.id === selectedCampaign);
    const gmail = gmailAccounts.find((a) => a.id === selectedGmail);
    const sequence = sequences.find((s) => s.id === campaign?.sequence_id);
    const dailyLimit = gmail?.daily_limit || 30;
    const leadsToSend = selectedLeads.slice(0, dailyLimit);
    const sendDelay = (campaign?.send_delay_minutes || 0) * 60 * 1000;

    setSendProgress({ current: 0, total: leadsToSend.length });

    let successCount = 0;
    let failCount = 0;
    let nextSendAt = null;

    for (let i = 0; i < leadsToSend.length; i++) {
      const lead = leadsToSend[i];
      setSendProgress({ current: i + 1, total: leadsToSend.length });

      const firstStep = sequence?.steps?.[0];
      const subject = firstStep?.subject || campaign?.name || "Quick question";
      const body = firstStep?.body || `Hi ${lead.first_name || "there"},\n\nI came across ${lead.company_name || "your company"} and wanted to connect.\n\nBest regards`;

      const secondStep = sequence?.steps?.[1];
      if (secondStep) {
        const delayMs = ((secondStep.delay_days || 0) * 24 * 60 * 60 * 1000) +
                        ((secondStep.delay_hours || 0) * 60 * 60 * 1000) +
                        ((secondStep.delay_minutes || 0) * 60 * 1000);
        nextSendAt = new Date(Date.now() + delayMs).toISOString();
      }

      const res = await base44.functions.invoke("sendEmail", {
        to: lead.email,
        subject,
        body,
        lead_id: lead.id,
        campaign_id: selectedCampaign,
        gmail_account_id: selectedGmail,
        sequence_step: "1st",
      });

      if (res.data?.success) {
        successCount++;
        if (nextSendAt) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const newLogs = await base44.entities.SendLog.list("-created_date", 10);
          const latestLog = newLogs.find((l) => l.lead_email === lead.email && l.campaign_id === selectedCampaign);
          if (latestLog) {
            await base44.entities.SendLog.update(latestLog.id, {
              next_step_index: 1,
              next_send_at: nextSendAt,
            });
          }
        }
      } else {
        failCount++;
      }

      if (i < leadsToSend.length - 1 && sendDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, sendDelay));
      }
    }

    if (campaign) {
      await base44.entities.Campaign.update(campaign.id, {
        total_sent: (campaign.total_sent || 0) + successCount,
        total_leads: (campaign.total_leads || 0) + leadsToSend.length,
        status: "Active",
      });
    }

    if (gmail) {
      await base44.entities.GmailAccount.update(gmail.id, {
        sent_today: (gmail.sent_today || 0) + successCount,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["send_logs"] });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });

    toast.success(`Campaign sent: ${successCount} delivered${failCount > 0 ? `, ${failCount} failed` : ""}${nextSendAt ? `. Follow-up scheduled!` : ""}`);
    setSending(false);
    setSendProgress({ current: 0, total: 0 });
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    const res = await base44.functions.invoke("checkReplies", {});
    if (res.data?.replies_found > 0) {
      toast.success(`Found ${res.data.replies_found} new repl${res.data.replies_found > 1 ? "ies" : "y"}!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["send_logs"] });
    } else {
      toast.message("No new replies found.");
    }
    setCheckingReplies(false);
  };

  const handleProcessFollowUps = async () => {
    setProcessingFollowUps(true);
    const res = await base44.functions.invoke("processSequenceSteps", {});
    if (res.data?.processed > 0) {
      toast.success(`Sent ${res.data.processed} follow-up email${res.data.processed > 1 ? "s" : ""}!`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["send_logs"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } else {
      toast.message(res.data?.message || "No follow-ups due yet.");
    }
    setProcessingFollowUps(false);
  };

  const handleClearLogs = async () => {
    setClearingLogs(true);
    setShowClearConfirm(false);

    const logsToClear = selectedFilterCampaign
      ? sendLogs.filter((log) => log.campaign_id === selectedFilterCampaign)
      : sendLogs;

    await Promise.all(logsToClear.map((log) => base44.entities.SendLog.delete(log.id)));

    if (selectedFilterCampaign) {
      await base44.entities.Campaign.update(selectedFilterCampaign, {
        total_sent: 0,
        total_replies: 0,
      });
    } else {
      await Promise.all(campaigns.map((c) =>
        base44.entities.Campaign.update(c.id, { total_sent: 0, total_replies: 0 })
      ));
    }

    const affectedLeadIds = [...new Set(logsToClear.map((log) => log.lead_id).filter(Boolean))];
    await Promise.all(affectedLeadIds.map((id) =>
      base44.entities.Lead.update(id, { status: "New", total_sends: 0, next_send_at: null })
    ));

    await queryClient.refetchQueries({ queryKey: ["send_logs"] });
    await queryClient.refetchQueries({ queryKey: ["campaigns"] });
    await queryClient.refetchQueries({ queryKey: ["leads"] });

    toast.success(`Cleared ${logsToClear.length} send log${logsToClear.length !== 1 ? "s" : ""} and reset lead statuses.`);
    setClearingLogs(false);
  };

  const logStatusIcon = {
    Queued: <Clock className="w-3.5 h-3.5 text-neutral-400" />,
    Sent: <CheckCircle className="w-3.5 h-3.5 text-neutral-700" />,
    Failed: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
    Opened: <Eye className="w-3.5 h-3.5 text-blue-500" />,
    Replied: <MessageSquare className="w-3.5 h-3.5 text-green-600" />,
  };

  const queuedCount = filteredSendLogs.filter((l) => l.status === "Queued").length;
  const sentCount = filteredSendLogs.filter((l) => l.status === "Sent" || l.status === "Opened" || l.status === "Replied").length;
  const replyCount = filteredSendLogs.filter((l) => l.status === "Replied").length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <Rocket className="w-4 h-4" /> Launch Campaign
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-600 dark:text-neutral-400">Email Account</Label>
            <Select value={selectedGmail} onValueChange={setSelectedGmail}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {gmailAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nickname} ({acc.sent_today || 0}/{acc.daily_limit || 30})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-600 dark:text-neutral-400">Database List</Label>
            <Select value={selectedLeadGroup} onValueChange={setSelectedLeadGroup}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select database" />
              </SelectTrigger>
              <SelectContent>
                {leadsGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} ({g.lead_count || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-600 dark:text-neutral-400">Campaign</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.filter((c) => c.status === "Active").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 w-full h-9 text-xs"
              disabled={!selectedCampaign || !selectedGmail || !selectedLeadGroup || selectedLeads.length === 0 || sending}
              onClick={handleStartCampaign}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              Start Campaign
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
            Sends to all New/Pending leads via real Gmail API (up to daily limit).
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleProcessFollowUps}
              disabled={processingFollowUps}
            >
              {processingFollowUps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
              )}
              Send Follow-ups
              {pendingFollowUps > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {pendingFollowUps}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleCheckReplies}
              disabled={checkingReplies}
            >
              {checkingReplies ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Check Replies
            </Button>
          </div>
        </div>

        {sending && sendProgress.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-neutral-500">Sending...</span>
              <span className="text-[11px] text-neutral-500">{sendProgress.current} / {sendProgress.total}</span>
            </div>
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5">
              <div
                className="bg-neutral-900 dark:bg-neutral-100 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{queuedCount}</p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Queued</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{sentCount}</p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Sent</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{replyCount}</p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Replies</p>
        </div>
      </div>

      {/* Send Logs Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Send Logs</h3>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <Select value={selectedFilterCampaign} onValueChange={setSelectedFilterCampaign}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filter by campaign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!showClearConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                onClick={() => setShowClearConfirm(true)}
                disabled={filteredSendLogs.length === 0 || clearingLogs}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear Logs
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-500">
                  Clear {selectedFilterCampaign ? "campaign" : "all"} logs?
                </span>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClearLogs}
                  disabled={clearingLogs}
                >
                  {clearingLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, Clear"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Lead</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Subject</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Step</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Next Follow-up</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSendLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-neutral-400 dark:text-neutral-500 py-10 text-sm">
                    No sends yet. Launch a campaign to get started.
                  </TableCell>
                </TableRow>
              )}
              {filteredSendLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {logStatusIcon[log.status] || logStatusIcon.Queued}
                      <span className="text-xs text-neutral-600 dark:text-neutral-300">{log.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-700 dark:text-neutral-300">{log.lead_name}</TableCell>
                  <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{log.lead_email}</TableCell>
                  <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">{log.sequence_step}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-neutral-400 dark:text-neutral-500">
                    {log.next_send_at && log.next_step_index > 0
                      ? format(new Date(log.next_send_at), "MMM d, h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-400 dark:text-neutral-500">
                    {log.created_date ? format(new Date(log.created_date), "MMM d, h:mm a") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}