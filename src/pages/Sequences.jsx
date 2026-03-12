import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy, FolderPlus, Folder, FolderOpen, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import SequenceEditor from "../components/sequences/SequenceEditor.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function Sequences() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => base44.entities.Sequence.list("-created_date", 100),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["sequenceFolders"],
    queryFn: () => base44.entities.SequenceFolder.list("-created_date", 100),
  });

  const createFolderMutation = useMutation({
    mutationFn: (name) => base44.entities.SequenceFolder.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequenceFolders"] });
      setFolderName("");
      setCreatingFolder(false);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId) => {
      // unassign all sequences in this folder
      const inFolder = sequences.filter((s) => s.folder_id === folderId);
      await Promise.all(inFolder.map((s) => base44.entities.Sequence.update(s.id, { folder_id: null })));
      return base44.entities.SequenceFolder.delete(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequenceFolders"] });
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities.Sequence.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setRenamingId(null);
    },
  });

  const handleRenameCommit = (id) => {
    const trimmed = renameValue.trim();
    if (trimmed) renameMutation.mutate({ id, name: trimmed });
    setRenamingId(null);
  };

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Sequence.create({
      name,
      steps: [{ id: "step-1", subject: "", body: "", delay_days: 0, delay_hours: 0 }],
      status: "Draft",
    }),
    onSuccess: (newSeq) => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setEditingId(newSeq.id);
      setCreatingNew(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Sequence.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (seq) => base44.entities.Sequence.create({
      name: `${seq.name} (Copy)`,
      steps: seq.steps,
      status: "Draft",
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, folder_id }) => base44.entities.Sequence.update(id, { folder_id: folder_id || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const toggleFolder = (folderId) =>
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));

  const currentSequence = editingId ? sequences.find((s) => s.id === editingId) : null;

  if (editingId && currentSequence) {
    return <SequenceEditor sequence={currentSequence} onBack={() => setEditingId(null)} />;
  }

  const ungrouped = sequences.filter((s) => !s.folder_id);

  const SequenceRow = ({ seq }) => (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between hover:border-neutral-300 transition-colors">
      <div className="flex-1 min-w-0">
        {renamingId === seq.id ? (
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleRenameCommit(seq.id); }
              if (e.key === "Escape") setRenamingId(null);
            }}
            onBlur={() => handleRenameCommit(seq.id)}
            className="font-medium text-neutral-900 border border-neutral-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-neutral-500 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center gap-2">
            <h3
              className="font-medium text-neutral-900 cursor-pointer hover:text-neutral-600"
              onClick={() => setEditingId(seq.id)}
            >
              {seq.name}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); setRenamingId(seq.id); setRenameValue(seq.name); }}
              className="text-[11px] text-neutral-400 border border-neutral-300 rounded-full px-2 py-0.5 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
            >
              Edit
            </button>
          </div>
        )}
        <p className="text-xs text-neutral-500 mt-1">
          {seq.steps?.length || 0} step{(seq.steps?.length || 0) !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded ${
          seq.status === "Draft" ? "bg-amber-50 text-amber-700" :
          seq.status === "Active" ? "bg-green-50 text-green-700" :
          "bg-neutral-100 text-neutral-600"
        }`}>
          {seq.status}
        </span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => duplicateMutation.mutate(seq)} title="Duplicate">
          <Copy className="w-4 h-4 text-neutral-500" />
        </Button>
        {/* Move to folder dropdown */}
        {folders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Move to folder">
                <MoreHorizontal className="w-4 h-4 text-neutral-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-neutral-500">Move to folder</DropdownMenuLabel>
              {seq.folder_id && (
                <>
                  <DropdownMenuItem onClick={() => moveMutation.mutate({ id: seq.id, folder_id: null })}>
                    Remove from folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  disabled={seq.folder_id === f.id}
                  onClick={() => moveMutation.mutate({ id: seq.id, folder_id: f.id })}
                >
                  <Folder className="w-3.5 h-3.5 mr-2 text-neutral-400" />
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(seq.id)} title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Sequences</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreatingNew(true)} className="bg-neutral-900 hover:bg-neutral-800">
            <Plus className="w-4 h-4 mr-2" />
            New Sequence
          </Button>
          <Button variant="outline" onClick={() => setCreatingFolder(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>
      </div>

      {creatingFolder && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Folder name (e.g., HVAC Sequences)"
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

      {creatingNew && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Sequence name (e.g., HVAC Outreach)"
            className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) createMutation.mutate(e.target.value.trim());
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={(e) => {
                const input = e.target.parentElement.previousElementSibling;
                if (input.value.trim()) createMutation.mutate(input.value.trim());
              }}
              className="bg-neutral-900 hover:bg-neutral-800"
            >
              Create
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreatingNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Folders */}
      {folders.map((folder) => {
        const folderSeqs = sequences.filter((s) => s.folder_id === folder.id);
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
              <span className="text-xs text-neutral-400 ml-1">({folderSeqs.length})</span>
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
                {folderSeqs.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-3">No sequences in this folder yet.</p>
                ) : (
                  folderSeqs.map((seq) => <SequenceRow key={seq.id} seq={seq} />)
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Ungrouped sequences */}
      <div className="grid gap-3">
        {ungrouped.map((seq) => <SequenceRow key={seq.id} seq={seq} />)}
      </div>

      {sequences.length === 0 && folders.length === 0 && !creatingNew && (
        <div className="text-center py-12">
          <p className="text-sm text-neutral-500">No sequences yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}