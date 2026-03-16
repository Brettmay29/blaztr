import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIELDS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "company_name", label: "Company" },
  { key: "state", label: "State" },
  { key: "industry", label: "Industry" },
  { key: "market", label: "Market" },
  { key: "company_website", label: "Website" },
];

const STATUS_OPTIONS = ["New", "Pending", "Sent", "Replied", "Bounced", "Opted Out"];
const SEQ_OPTIONS = ["1st", "2nd"];

export default function EditLeadDialog({ lead, onSave, onClose }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (lead) setForm({ ...lead });
  }, [lead]);

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    onSave(lead.id, form);
    onClose();
  };

  if (!lead) return null;

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Edit Lead</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-neutral-500">{label}</Label>
              <Input
                value={form[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Status</Label>
            <Select value={form.status || "New"} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Sequence</Label>
            <Select value={form.sequence_type || "1st"} onValueChange={(v) => handleChange("sequence_type", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEQ_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="text-xs h-8 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200" onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
