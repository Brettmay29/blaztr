import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Rocket, Send, Loader2, CheckCircle, AlertCircle, Clock,
  Eye, MessageSquare, RefreshCw, CalendarClock, Trash2, Pause, Square, StopCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SendHub() {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedGmail, setSelectedGmail] = useState("");
  const [selectedLeadGroup, setSelectedLeadGroup] = useState("");
  const [selectedFilterCampaign, setSelectedFilterCampaign] = useState("");
  const [activating, setActivating] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [processingFollowUps, setProcessingFollowUps] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endingCampaign, setEndingCampaign] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list(),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["campaignFolders"],
    queryFn: () => base44.entities.CampaignFolder.list("-created_date", 100),
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

  const selectedCampaignData = campaigns.find((c) => c.id === selectedCampaign);
  const selectedCampaignStatus = selectedCampaignData?.status;

  const filteredSendLogs = selectedFilterCampaign
    ? sendLogs.filter((log) => log.campaign_id === selectedFilterCampaign)
    : sendLogs;

  const now = new Date();
  const pendingFollowUps = sendLogs.filter((log) => {
    if (!log.next_send_at || !log.next_step_index) return false;
    return new Date(log.next_send_at) <= now && log.status === 'Sent';
  }).length;

  // ── Activate Campaign (replaces Start Campaign send loop) ─────────────────
  const handleActivateCampaign = async () => {
    if (!selectedCampaign || !selectedGmail || !selectedLeadGroup) return;
    setActivating(true);
    try {
      await base44.entities.Campaign.update(selectedCampaign, {
        gmail_account_id: selectedGmail,
        leads_group_id: selectedLeadGroup,
        status: "Active",
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign activated! The cron job will begin sending within 5 minutes.");
      setSelectedCampaign("");
      setSelectedGmail("");
      setSelectedLeadGroup("");
    } catch (err) {
      toast.error("Failed to activate campaign.");
    }
    setActivating(false);
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return;
    await base44.entities.Campaign.update(selectedCampaign, { status: "Paused" });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    toast.success("Campaign paused. Follow-ups are frozen but replies will still be recorded.");
  };

  const handleResumeCampaign = async () => {
    if (!selectedCampaign) return;
    await base44.entities.Campaign.update(selectedCampaign, { status: "Active" });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    toast.success("Campaign resumed! Next batch will send within 5 minutes.");
  };

  const handleEndCampaign = async () => {
    if (!selectedCampaign) return;
    setEndingCampaign(true);
    setShowEndConfirm(false);

    let completedFolder = folders.find((f) => f.name === "Completed");
    if (!completedFolder) {
      completedFolder = await base44.entities.CampaignFolder.create({ name: "Completed" });
      queryClient.invalidateQueries({ queryKey: ["campaignFolders"] });
    }

    const campaignLogs = sendLogs.filter((l) =>
      l.campaign_id === selectedCampaign && l.next_send_at && l.next_step_index > 0
    );
    await Promise.all(campaignLogs.map((l) =>
      base44.entities.SendLog.update(l.id, { next_step_index: 0, next_send_at: '' })
    ));

    await base44.entities.Campaign.update(selectedCampaign, {
      status: "Completed",
      folder_id: completedFolder.id,
    });

    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["send_logs"] });
    queryClient.invalidateQueries({ queryKey: ["campaignFolders"] });

    toast.success("Campaign ended and moved to Completed folder.");
    setSelectedCampaign("");
    setEndingCampaign(false);
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
    if (res.data?.followups_processed > 0 || res.data?.step1_processed > 0) {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["send_logs"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } else {
      toast.message(res.data?.message || "No emails due yet.");
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
      await base44.entities.Campaign.update(selectedFilterCampaign, { total_sent: 0, total_replies: 0 });
    } else {
      await Promise.all(campaigns.map((c) =>
        base44.entities.Campaign.update(c.id, { total_sent: 0, total_replies: 0 })
      ));
    }

    const affectedLeadIds = [...new Set(logsToClear.map((log) => log.lead_id).filter(Boolean))];
    await Promise.all(affectedLeadIds.map((id) =>
      base44.entities.Lead.update(id, { status: "New", total_sends: 0, next_send_at: null })
    ));

    queryClient.setQueryData(["send_logs"], []);
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
  const sentCount = filteredSendLogs.filter((l) => ["Sent","Opened","Replied"].includes(l.status)).length;
  const replyCount = filteredSendLogs.filter((l) => l.status === "Replied").length;

  // Active campaigns (for controls panel)
  const activePausedCampaigns = campaigns.filter((c) => c.status === "Active" || c.status === "Paused");

  return (
    <div className="space-y-6">

      {/* ── Activate Campaign ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1 flex items-center gap-2">
          <Rocket className="w-4 h-4" /> Activate Campaign
        </h2>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-4">
          Select your campaign, sender, and database — then click Activate. The cron job handles all sending automatically every 5 minutes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-neutral-600 dark:text-neutral-400">Campaign</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.filter((c) => c.status !== "Completed").map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.status === "Paused" ? "⏸" : c.status === "Active" ? "▶" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="flex items-end">
            <Button
              className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 w-full h-9 text-xs"
              disabled={!selectedCampaign || !selectedGmail || !selectedLeadGroup || activating}
              onClick={handleActivateCampaign}
            >
              {activating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {activating ? "Activating..." : "Activate Campaign"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Campaign Controls ─────────────────────────────────────────────── */}
      {activePausedCampaigns.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Campaign Controls
          </h2>
          <div className="space-y-2">
            {activePausedCampaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{c.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${c.status === 'Active' ? 'text-green-600 border-green-300' : 'text-yellow-600 border-yellow-300'}`}>
                    {c.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "Active" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                      onClick={async () => {
                        await base44.entities.Campaign.update(c.id, { status: "Paused" });
                        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
                        toast.success(`"${c.name}" paused.`);
                      }}>
                      <Pause className="w-3 h-3 mr-1" /> Pause
                    </Button>
                  )}
                  {c.status === "Paused" && (
                    <Button variant="outline" size="sm" className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                      onClick={async () => {
                        await base44.entities.Campaign.update(c.id, { status: "Active" });
                        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
                        toast.success(`"${c.name}" resumed!`);
                      }}>
                      <Send className="w-3 h-3 mr-1" /> Resume
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm(`End campaign "${c.name}"? This will move it to Completed.`)) return;
                      let completedFolder = folders.find((f) => f.name === "Completed");
                      if (!completedFolder) {
                        completedFolder = await base44.entities.CampaignFolder.create({ name: "Completed" });
                        queryClient.invalidateQueries({ queryKey: ["campaignFolders"] });
                      }
                      const campaignLogs = sendLogs.filter((l) => l.campaign_id === c.id && l.next_send_at && l.next_step_index > 0);
                      await Promise.all(campaignLogs.map((l) => base44.entities.SendLog.update(l.id, { next_step_index: 0, next_send_at: '' })));
                      await base44.entities.Campaign.update(c.id, { status: "Completed", folder_id: completedFolder.id });
                      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
                      toast.success(`"${c.name}" ended and moved to Completed.`);
                    }}>
                    <Square className="w-3 h-3 mr-1" /> End
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Manual Trigger Buttons ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleProcessFollowUps} disabled={processingFollowUps}>
          {processingFollowUps ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CalendarClock className="w-3.5 h-3.5 mr-1.5" />}
          Run Cron Now
          {pendingFollowUps > 0 && (
            <span className="ml-1.5 bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingFollowUps}</span>
          )}
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCheckReplies} disabled={checkingReplies}>
          {checkingReplies ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Check Replies
        </Button>
        <p className="text-[11px] text-neutral-400 ml-2">Cron runs automatically every 5 min — use these buttons to trigger manually.</p>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
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

      {/* ── Send Logs ─────────────────────────────────────────────────────── */}
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
              <Button variant="outline" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:border-red-300"
                onClick={() => setShowClearConfirm(true)} disabled={filteredSendLogs.length === 0 || clearingLogs}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear Logs
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-500">Clear {selectedFilterCampaign ? "campaign" : "all"} logs?</span>
                <Button size="sm" className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={handleClearLogs} disabled={clearingLogs}>
                  {clearingLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, Clear"}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Lead</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Subject</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Step</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Next Follow-up</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSendLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-neutral-400 py-10 text-sm">
                    No sends yet. Activate a campaign to get started.
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
                  <TableCell><Badge variant="outline" className="text-[11px]">{log.sequence_step}</Badge></TableCell>
                  <TableCell className="text-xs text-neutral-400">
                    {log.next_send_at && log.next_step_index > 0 ? format(new Date(log.next_send_at), "MMM d, h:mm a") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-400">
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
