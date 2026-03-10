import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Zap, Send, Loader2, CheckCircle, AlertCircle, Clock, Eye, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SendHub() {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedGmail, setSelectedGmail] = useState("");
  const [sending, setSending] = useState(false);

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

  const selectedLeads = leads.filter((l) => l.status === "New" || l.status === "Pending");

  const handleStartCampaign = async () => {
    if (!selectedCampaign || !selectedGmail) return;
    setSending(true);

    const campaign = campaigns.find((c) => c.id === selectedCampaign);
    const gmail = gmailAccounts.find((a) => a.id === selectedGmail);
    const dailyLimit = gmail?.daily_limit || 30;
    const leadsToSend = selectedLeads.slice(0, dailyLimit);

    const now = new Date();
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const sendLogEntries = leadsToSend.map((lead) => ({
      lead_id: lead.id,
      campaign_id: selectedCampaign,
      gmail_account_id: selectedGmail,
      status: "Queued",
      lead_email: lead.email,
      lead_name: lead.first_name,
      subject: campaign?.name || "Campaign",
      sequence_step: "1st",
    }));

    await base44.entities.SendLog.bulkCreate(sendLogEntries);

    for (const lead of leadsToSend) {
      await base44.entities.Lead.update(lead.id, {
        status: "Sent",
        latest_send: now.toISOString().split("T")[0],
        total_sends: (lead.total_sends || 0) + 1,
        next_send: campaign?.sequence_type?.includes("Follow-up")
          ? threeDaysLater.toISOString().split("T")[0]
          : "",
        sender_email: gmail?.email || "",
        sequence_type: "1st",
      });
    }

    if (campaign) {
      await base44.entities.Campaign.update(campaign.id, {
        total_sent: (campaign.total_sent || 0) + leadsToSend.length,
        total_leads: (campaign.total_leads || 0) + leadsToSend.length,
        status: "Active",
      });
    }

    if (gmail) {
      await base44.entities.GmailAccount.update(gmail.id, {
        sent_today: (gmail.sent_today || 0) + leadsToSend.length,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["send_logs"] });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });

    setSending(false);
  };

  const logStatusIcon = {
    Queued: <Clock className="w-3.5 h-3.5 text-neutral-400" />,
    Sent: <CheckCircle className="w-3.5 h-3.5 text-neutral-700" />,
    Failed: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
    Opened: <Eye className="w-3.5 h-3.5 text-blue-500" />,
    Replied: <MessageSquare className="w-3.5 h-3.5 text-green-600" />,
  };

  const queuedCount = sendLogs.filter((l) => l.status === "Queued").length;
  const sentCount = sendLogs.filter((l) => l.status === "Sent" || l.status === "Opened" || l.status === "Replied").length;
  const openCount = sendLogs.filter((l) => l.status === "Opened").length;
  const replyCount = sendLogs.filter((l) => l.status === "Replied").length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Launch Campaign
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Gmail Account</Label>
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
            <Label className="text-xs">Campaign</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="bg-neutral-900 hover:bg-neutral-800 w-full h-9 text-xs"
              disabled={!selectedCampaign || !selectedGmail || selectedLeads.length === 0 || sending}
              onClick={handleStartCampaign}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1.5" />
              )}
              Start Campaign ({selectedLeads.length} leads)
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-neutral-400 mt-3">
          Sends to all New/Pending leads (up to daily limit). No auto-rotation.
        </p>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{queuedCount}</p>
          <p className="text-[11px] text-neutral-500">Queued</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{sentCount}</p>
          <p className="text-[11px] text-neutral-500">Sent</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{openCount}</p>
          <p className="text-[11px] text-neutral-500">Opens</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{replyCount}</p>
          <p className="text-[11px] text-neutral-500">Replies</p>
        </div>
      </div>

      {/* Send Log Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-medium text-neutral-800">Send Log</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Lead</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Email</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Subject</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Step</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sendLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-neutral-400 py-10 text-sm">
                    No sends yet. Launch a campaign to get started.
                  </TableCell>
                </TableRow>
              )}
              {sendLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {logStatusIcon[log.status] || logStatusIcon.Queued}
                      <span className="text-xs text-neutral-600">{log.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-700">{log.lead_name}</TableCell>
                  <TableCell className="text-sm text-neutral-500">{log.lead_email}</TableCell>
                  <TableCell className="text-sm text-neutral-500">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">{log.sequence_step}</Badge>
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