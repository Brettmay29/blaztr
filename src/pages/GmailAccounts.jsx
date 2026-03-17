import { useState } from "react";
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
import { Mail, Settings, Trash2, Loader2, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function GmailAccounts() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", nickname: "", daily_limit: 30, first_name: "", last_name: "", signature: "" });
  const [oauthLoading, setOauthLoading] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});

  const { data: accounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const handleOAuthConnect = async () => {
    setOauthLoading(true);
    try {
      const res = await base44.functions.invoke("initiateGmailOAuth", {});
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Could not start OAuth flow. Try again.");
        setOauthLoading(false);
      }
    } catch {
      toast.error("OAuth initiation failed.");
      setOauthLoading(false);
    }
  };

  const handleCheckConnection = async (acc) => {
    setCheckingConnection((prev) => ({ ...prev, [acc.id]: true }));
    try {
      let accessToken = acc.access_token;

      if (!accessToken) {
        try {
          const conn = await base44.functions.invoke("getGmailProfile", {});
          if (conn.data?.email === acc.email) {
            setConnectionStatus((prev) => ({ ...prev, [acc.id]: "connected" }));
            await base44.entities.GmailAccount.update(acc.id, { is_connected: true });
            queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });
            return;
          }
        } catch {}
        setConnectionStatus((prev) => ({ ...prev, [acc.id]: "unknown" }));
        return;
      }

      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.emailAddress?.toLowerCase() === acc.email?.toLowerCase()) {
          setConnectionStatus((prev) => ({ ...prev, [acc.id]: "connected" }));
          await base44.entities.GmailAccount.update(acc.id, { is_connected: true });
          toast.success(`${acc.email} is connected!`);
        } else {
          setConnectionStatus((prev) => ({ ...prev, [acc.id]: "unknown" }));
        }
      } else if (profileRes.status === 401) {
        if (acc.refresh_token) {
          const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: '74188123197-1dhi733ml4cl831d28nic2uk9opdvkqu.apps.googleusercontent.com',
              client_secret: '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',
              refresh_token: acc.refresh_token,
              grant_type: 'refresh_token',
            }),
          });

          if (refreshRes.ok) {
            const tokens = await refreshRes.json();
            await base44.entities.GmailAccount.update(acc.id, {
              access_token: tokens.access_token,
              is_connected: true,
            });
            queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });
            setConnectionStatus((prev) => ({ ...prev, [acc.id]: "connected" }));
            toast.success(`${acc.email} reconnected with refreshed token!`);
          } else {
            setConnectionStatus((prev) => ({ ...prev, [acc.id]: "not_connected" }));
            await base44.entities.GmailAccount.update(acc.id, { is_connected: false });
            queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });
            toast.error(`${acc.email} is disconnected. Please re-authenticate via OAuth.`);
          }
        } else {
          setConnectionStatus((prev) => ({ ...prev, [acc.id]: "not_connected" }));
          await base44.entities.GmailAccount.update(acc.id, { is_connected: false });
          queryClient.invalidateQueries({ queryKey: ["gmail_accounts"] });
          toast.error(`${acc.email} is disconnected. Please re-authenticate via OAuth.`);
        }
      } else {
        setConnectionStatus((prev) => ({ ...prev, [acc.id]: "unknown" }));
      }
    } catch (err) {
      setConnectionStatus((prev) => ({ ...prev, [acc.id]: "unknown" }));
      toast.error("Could not check connection.");
    } finally {
      setCheckingConnection((prev) => ({ ...prev, [acc.id]: false }));
    }
  };

  const getStatusBadge = (acc) => {
    const status = connectionStatus[acc.id];
    if (status === "connected") {
      return <Badge className="text-[11px] bg-green-50 text-green-700 border-green-200">Connected</Badge>;
    }
    if (status === "not_connected") {
      return <Badge className="text-[11px] bg-red-50 text-red-700 border-red-200">Not Connected</Badge>;
    }
    if (status === "unknown") {
      return <Badge className="text-[11px] bg-yellow-50 text-yellow-700 border-yellow-200">Unknown</Badge>;
    }
    if (acc.is_connected) {
      return <Badge className="text-[11px] bg-green-50 text-green-700 border-green-200">Connected</Badge>;
    }
    return <Badge className="text-[11px] bg-yellow-50 text-yellow-700 border-yellow-200">Unknown</Badge>;
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

  const openEdit = (acc) => {
    setEditing(acc);
    setForm({
      email: acc.email,
      nickname: acc.nickname,
      daily_limit: acc.daily_limit || 30,
      first_name: acc.first_name || "",
      last_name: acc.last_name || "",
      signature: acc.signature || ""
    });
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
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Email Accounts</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Add up to 10 email accounts for sending.</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9"
            onClick={handleOAuthConnect}
            disabled={oauthLoading || accounts.length >= 10}
          >
            {oauthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
            + OAuth Account
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
            <Mail className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No Gmail accounts connected yet.</p>
          </div>
        )}
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Mail className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{acc.nickname}</p>
                <p className="text-xs text-neutral-500">{acc.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {acc.sent_today || 0}/{acc.daily_limit || 30} today
              </Badge>
              {getStatusBadge(acc)}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={() => handleCheckConnection(acc)}
                disabled={checkingConnection[acc.id]}
                title="Check connection"
              >
                {checkingConnection[acc.id]
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(acc.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Email Account Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-96 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs">Gmail Address</Label>
              <Input placeholder="you@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nickname</Label>
              <Input placeholder="e.g. Sender1, HVAC_Aged" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name</Label>
                <Input placeholder="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Signature</Label>
              <textarea
                value={form.signature}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                placeholder="Add your email signature here..."
                rows={4}
                style={{ fontFamily: 'sans-serif', fontSize: '12px' }}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily Limit</Label>
              <Input type="number" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: parseInt(e.target.value) || 30 })} className="h-9 text-sm w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button className="bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100" onClick={handleSave} disabled={!form.email || !form.nickname}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}