import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function GmailAccounts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", nickname: "", daily_limit: 30 });

  const { data: accounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const [detecting, setDetecting] = useState(false);

  const handleDetectGmail = async () => {
    setDetecting(true);
    const res = await base44.functions.invoke("getGmailProfile", {});
    if (res.data?.email) {
      const email = res.data.email;
      const alreadyExists = accounts.find((a) => a.email === email);
      if (alreadyExists) {
        toast.message(`${email} is already connected.`);
      } else {
        setForm({ email, nickname: email.split("@")[0], daily_limit: 30 });
        setDialogOpen(true);
      }
    } else {
      toast.error("Could not detect Gmail. Try again.");
    }
    setDetecting(false);
  };

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.GmailAccount.update(editing.id, data)
        : base44.entities.GmailAccount.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GmailAccount.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ email: "", nickname: "", daily_limit: 30 });
    setDialogOpen(true);
  };

  const openEdit = (acc) => {
    setEditing(acc);
    setForm({ email: acc.email, nickname: acc.nickname, daily_limit: acc.daily_limit || 30 });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...form, is_connected: true, sent_today: editing?.sent_today || 0 });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Gmail Accounts</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Add up to 10 Gmail accounts for sending.</p>
        </div>
        <Button
          size="sm"
          className="bg-neutral-900 hover:bg-neutral-800 text-xs h-9"
          onClick={openNew}
          disabled={accounts.length >= 10}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Connect Gmail
        </Button>
      </div>

      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
            <Mail className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No Gmail accounts connected yet.</p>
          </div>
        )}
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Mail className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{acc.nickname}</p>
                <p className="text-xs text-neutral-500">{acc.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {acc.sent_today || 0}/{acc.daily_limit || 30} today
              </Badge>
              <Badge variant="secondary" className="text-[11px] bg-green-50 text-green-700">
                Connected
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(acc.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Edit Gmail Account" : "Connect Gmail Account"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Gmail Address</Label>
              <Input
                placeholder="you@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nickname</Label>
              <Input
                placeholder="e.g. Sender1, HVAC_Aged"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily Limit</Label>
              <Input
                type="number"
                value={form.daily_limit}
                onChange={(e) => setForm({ ...form, daily_limit: parseInt(e.target.value) || 30 })}
                className="h-9 text-sm w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="bg-neutral-900 hover:bg-neutral-800" onClick={handleSave} disabled={!form.email || !form.nickname}>
              {editing ? "Save" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}