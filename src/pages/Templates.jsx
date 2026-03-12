import React, { useState, useRef } from "react";
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
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const placeholders = ["{first_name}", "{company_name}", "{state}", "{market}", "{company_website}"];

export default function Templates() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "", type: "Intro" });
  const quillRef = useRef(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.EmailTemplate.update(editing.id, data)
        : base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", subject: "", body: "", type: "Intro" });
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body, type: t.type });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Email Templates</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Create templates with merge placeholders.</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-9" onClick={openNew}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Template
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[11px] text-neutral-400 mr-1">Placeholders:</span>
        {placeholders.map((p) => (
          <Badge key={p} variant="outline" className="text-[11px] font-mono text-neutral-500">{p}</Badge>
        ))}
      </div>

      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
            <FileText className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No templates yet. Create your first one.</p>
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{t.name}</p>
                  <Badge variant="secondary" className="text-[11px]">{t.type}</Badge>
                </div>
                <p className="text-xs text-neutral-500 mb-2">Subject: {t.subject}</p>
                <p className="text-xs text-neutral-400 line-clamp-2">{t.body}</p>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteMutation.mutate(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template Name</Label>
                <Input
                  placeholder="e.g. Intro Email"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intro">Intro</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject Line</Label>
              <Input
                placeholder="Quick question about {company_name}"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Body</Label>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <ReactQuill
                  ref={quillRef}
                  value={form.body}
                  onChange={(value) => setForm({ ...form, body: value })}
                  theme="snow"
                  placeholder="Hi {first_name}, I noticed {company_name} in {state}..."
                  modules={{
                    toolbar: [
                      [{ font: ["arial", "courier", "georgia", "helvetica", "tahoma", "times-new-roman", "trebuchet", "verdana"] }],
                      [{ size: ["small", false, "large", "huge"] }],
                      ["bold", "italic", "underline"],
                      ["link"],
                      [{ list: "ordered" }, { list: "bullet" }],
                    ],
                  }}
                  formats={["font", "size", "bold", "italic", "underline", "link", "list"]}
                  style={{ height: "200px" }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              className="bg-neutral-900 hover:bg-neutral-800"
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name || !form.subject || !form.body}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}