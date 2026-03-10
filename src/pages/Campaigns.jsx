import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Eye, MessageSquare, Pencil, Trash2 } from "lucide-react";

const campaignStatusStyles = {
  Draft: "bg-neutral-100 text-neutral-600",
  Active: "bg-neutral-800 text-white",
  Paused: "bg-yellow-50 text-yellow-700",
  Completed: "bg-green-50 text-green-700",
};

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    gmail_account_id: "",
    gmail_nickname: "",
    sequence_type: "1st Email Only",
    send_window_start: "09:00",
    send_window_end: "17:00",
    daily_limit: 30,
    status: "Draft",
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list("-created_date"),
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.Campaign.update(editing.id, data)
        : base44.entities.Campaign.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Campaign.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      gmail_account_id: "",
      gmail_nickname: "",
      sequence_type: "1st Email Only",
      send_window_start: "09:00",
      send_window_end: "17:00",
      daily_limit: 30,
      send_delay_minutes: 1,
      status: "Draft",
    });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      gmail_account_id: c.gmail_account_id || "",
      gmail_nickname: c.gmail_nickname || "",
      sequence_type: c.sequence_type,
      send_window_start: c.send_window_start || "09:00",
      send_window_end: c.send_window_end || "17:00",
      daily_limit: c.daily_limit || 30,
      send_delay_minutes: c.send_delay_minutes || 1,
      status: c.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleGmailChange = (accId) => {
    const acc = gmailAccounts.find((a) => a.id === accId);
    setForm({ ...form, gmail_account_id: accId, gmail_nickname: acc?.nickname || "" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Campaigns</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Create and manage email campaigns.</p>
        </div>
      </div>

      <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-neutral-900 hover:bg-neutral-800 text-xs h-9" onClick={openNew}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Campaign
            </Button>
          </div>
          <div className="space-y-3">
        {campaigns.length === 0 && (
          <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
            <Send className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No campaigns yet.</p>
          </div>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                  <Badge className={campaignStatusStyles[c.status] + " text-[11px]"}>{c.status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  {c.gmail_nickname && <span>via {c.gmail_nickname}</span>}
                  <span>{c.sequence_type}</span>
                  <span>{c.send_window_start}–{c.send_window_end}</span>
                  <span>Limit: {c.daily_limit}/day</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Send className="w-3 h-3" /> {c.total_sent || 0} sent
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <Eye className="w-3 h-3" /> {c.total_opens || 0} opens
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-500">
                    <MessageSquare className="w-3 h-3" /> {c.total_replies || 0} replies
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteMutation.mutate(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign Name</Label>
              <Input
                placeholder="e.g. HVAC Residential Blast"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gmail Account</Label>
              <Select value={form.gmail_account_id} onValueChange={handleGmailChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select Gmail account" />
                </SelectTrigger>
                <SelectContent>
                  {gmailAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.nickname} ({acc.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sequence</Label>
              <Select value={form.sequence_type} onValueChange={(v) => setForm({ ...form, sequence_type: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st Email Only">1st Email Only</SelectItem>
                  <SelectItem value="1st + Follow-up (3 days)">1st + Follow-up (3 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Window Start</Label>
                <Input
                  type="time"
                  value={form.send_window_start}
                  onChange={(e) => setForm({ ...form, send_window_start: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Window End</Label>
                <Input
                  type="time"
                  value={form.send_window_end}
                  onChange={(e) => setForm({ ...form, send_window_end: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Daily Limit</Label>
                <Input
                  type="number"
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: parseInt(e.target.value) || 30 })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Wait between sends</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Wait</span>
                <Select value={String(form.send_delay_minutes)} onValueChange={(v) => setForm({ ...form, send_delay_minutes: parseInt(v) })}>
                  <SelectTrigger className="h-9 text-sm w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 30].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-neutral-500">minutes between sends</span>
              </div>
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              className="bg-neutral-900 hover:bg-neutral-800"
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}