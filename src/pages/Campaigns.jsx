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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Send, Eye, MessageSquare, Pencil, Trash2,
  FolderPlus, Folder, FolderOpen, ChevronDown, ChevronRight, MoreHorizontal,
} from "lucide-react";

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
    sequence_id: "",
    send_window_start: "09:00",
    send_window_end: "17:00",
    send_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    daily_limit: 30,
    send_delay_minutes: 1,
    start_immediately: false,
    status: "Draft",
  });

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list("-created_date"),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["campaignFolders"],
    queryFn: () => base44.entities.CampaignFolder.list("-created_date", 100),
  });

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => base44.entities.Sequence.list("-created_date", 100),
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

  const createFolderMutation = useMutation({
    mutationFn: (name) => base44.entities.CampaignFolder.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaignFolders"] });
      setFolderName("");
      setCreatingFolder(false);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId) => {
      const inFolder = campaigns.filter((c) => c.folder_id === folderId);
      await Promise.all(inFolder.map((c) => base44.entities.Campaign.update(c.id, { folder_id: null })));
      return base44.entities.CampaignFolder.delete(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaignFolders"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, folder_id }) => base44.entities.Campaign.update(id, { folder_id: folder_id || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      gmail_account_id: "",
      gmail_nickname: "",
      sequence_id: "",
      send_window_start: "09:00",
      send_window_end: "17:00",
      daily_limit: 30,
      send_delay_minutes: 1,
      start_immediately: false,
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
      sequence_id: c.sequence_id || "",
      send_window_start: c.send_window_start || "09:00",
      send_window_end: c.send_window_end || "17:00",
      daily_limit: c.daily_limit || 30,
      send_delay_minutes: c.send_delay_minutes || 1,
      start_immediately: c.start_immediately || false,
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

  const toggleFolder = (folderId) =>
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));

  const ungrouped = campaigns.filter((c) => !c.folder_id);

  const CampaignRow = ({ c }) => (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-medium text-neutral-900">{c.name}</p>
            <Badge className={campaignStatusStyles[c.status] + " text-[11px]"}>{c.status}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {c.gmail_nickname && <span>via {c.gmail_nickname}</span>}
            {c.sequence_id && <span>{sequences.find(s => s.id === c.sequence_id)?.name || ""}</span>}
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
          {folders.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Move to folder">
                  <MoreHorizontal className="w-4 h-4 text-neutral-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-neutral-500">Move to folder</DropdownMenuLabel>
                {c.folder_id && (
                  <>
                    <DropdownMenuItem onClick={() => moveMutation.mutate({ id: c.id, folder_id: null })}>
                      Remove from folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {folders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    disabled={c.folder_id === f.id}
                    onClick={() => moveMutation.mutate({ id: c.id, folder_id: f.id })}
                  >
                    <Folder className="w-3.5 h-3.5 mr-2 text-neutral-400" />
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(c.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Campaigns</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Create and manage email campaigns.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-neutral-900 hover:bg-neutral-800 text-xs h-9" onClick={openNew}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Campaign
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-9" onClick={() => setCreatingFolder(true)}>
            <FolderPlus className="w-3.5 h-3.5 mr-1.5" /> New Folder
          </Button>
        </div>
      </div>

      {creatingFolder && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Folder name (e.g., Q1 Campaigns)"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) createFolderMutation.mutate(folderName.trim());
              if (e.key === "Escape") { setCreatingFolder(false); setFolderName(""); }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!folderName.trim()} onClick={() => createFolderMutation.mutate(folderName.trim())} className="bg-neutral-900 hover:bg-neutral-800">
              Create Folder
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setCreatingFolder(false); setFolderName(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {folders.map((folder) => {
        const folderCampaigns = campaigns.filter((c) => c.folder_id === folder.id);
        const isCollapsed = collapsedFolders[folder.id];
        return (
          <div key={folder.id} className="border border-neutral-200 rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3 bg-neutral-50 cursor-pointer hover:bg-neutral-100 transition-colors"
              onClick={() => toggleFolder(folder.id)}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              {isCollapsed ? <Folder className="w-4 h-4 text-neutral-500" /> : <FolderOpen className="w-4 h-4 text-neutral-500" />}
              <span className="text-sm font-medium text-neutral-800">{folder.name}</span>
              <span className="text-xs text-neutral-400 ml-1">({folderCampaigns.length})</span>
              <button
                className="ml-auto text-neutral-400 hover:text-red-500 transition-colors p-1"
                onClick={(e) => { e.stopPropagation(); deleteFolderMutation.mutate(folder.id); }}
                title="Delete folder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {!isCollapsed && (
              <div className="p-3 space-y-2 bg-white">
                {folderCampaigns.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-3">No campaigns in this folder yet.</p>
                ) : (
                  folderCampaigns.map((c) => <CampaignRow key={c.id} c={c} />)
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-3">
        {ungrouped.map((c) => <CampaignRow key={c.id} c={c} />)}
      </div>

      {campaigns.length === 0 && folders.length === 0 && !creatingFolder && (
        <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
          <Send className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">No campaigns yet.</p>
        </div>
      )}

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
              <Select value={form.sequence_id} onValueChange={(v) => setForm({ ...form, sequence_id: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a sequence" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {sequences.length === 0 && (
                    <SelectItem value="none" disabled>No sequences found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={`space-y-1.5 ${form.start_immediately ? "opacity-40 pointer-events-none" : ""}`}>
                <Label className="text-xs">Window Start</Label>
                <Input
                  type="time"
                  value={form.send_window_start}
                  onChange={(e) => setForm({ ...form, send_window_start: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className={`space-y-1.5 ${form.start_immediately ? "opacity-40 pointer-events-none" : ""}`}>
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
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="start_immediately"
                checked={form.start_immediately}
                onCheckedChange={(v) => setForm({ ...form, start_immediately: !!v })}
              />
              <label htmlFor="start_immediately" className="text-sm text-neutral-700 cursor-pointer select-none">
                Start Immediately
              </label>
              {form.start_immediately && (
                <span className="text-xs text-neutral-400 ml-1">(ignores send window)</span>
              )}
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