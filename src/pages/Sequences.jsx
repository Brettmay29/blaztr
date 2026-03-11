import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Archive, Copy, FolderPlus } from "lucide-react";
import SequenceEditor from "../components/sequences/SequenceEditor.jsx";

export default function Sequences() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities.Sequence.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setRenamingId(null);
    },
  });

  const handleRenameCommit = (id) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameMutation.mutate({ id, name: trimmed });
    }
    setRenamingId(null);
  };

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => base44.entities.Sequence.list("-created_date", 100),
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (seq) => {
      return base44.entities.Sequence.create({
        name: `${seq.name} (Copy)`,
        steps: seq.steps,
        status: "Draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  const currentSequence = editingId ? sequences.find((s) => s.id === editingId) : null;

  if (editingId && currentSequence) {
    return <SequenceEditor sequence={currentSequence} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Sequences</h2>
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

      {creatingNew && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Sequence name (e.g., HVAC Outreach)"
            className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                createMutation.mutate(e.target.value.trim());
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={(e) => {
                const input = e.target.parentElement.previousElementSibling;
                if (input.value.trim()) {
                  createMutation.mutate(input.value.trim());
                }
              }}
              className="bg-neutral-900 hover:bg-neutral-800"
            >
              Create
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingNew(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {sequences.map((seq) => (
          <div key={seq.id} className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between hover:border-neutral-300 transition-colors">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(seq.id);
                      setRenameValue(seq.name);
                    }}
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
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => duplicateMutation.mutate(seq)}
                title="Duplicate"
              >
                <Copy className="w-4 h-4 text-neutral-500" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-500 hover:text-red-700"
                onClick={() => deleteMutation.mutate(seq.id)}
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {sequences.length === 0 && !creatingNew && (
        <div className="text-center py-12">
          <p className="text-sm text-neutral-500">No sequences yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}