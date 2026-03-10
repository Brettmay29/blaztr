import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ImportLeadsDialog({ open, onOpenChange, onImported }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            assigned_to: { type: "string" },
            sender_email: { type: "string" },
            first_send: { type: "string" },
            latest_send: { type: "string" },
            total_sends: { type: "number" },
            next_send: { type: "string" },
            reply_sentiment: { type: "string" },
            company_name: { type: "string" },
            first_name: { type: "string" },
            email: { type: "string" },
            state: { type: "string" },
            company_website: { type: "string" },
            industry: { type: "string" },
            market: { type: "string" },
            opens: { type: "number" },
            clicks: { type: "number" },
            status: { type: "string" },
            sequence_type: { type: "string" },
            alternate_emails: { type: "string" },
          },
        },
      },
    });

    if (result.status === "success" && result.output) {
      const leadsToCreate = (Array.isArray(result.output) ? result.output : [result.output]).map((lead) => ({
        ...lead,
        total_sends: lead.total_sends || 0,
        opens: lead.opens || 0,
        clicks: lead.clicks || 0,
        status: lead.status || "New",
        sequence_type: lead.sequence_type || "1st",
        reply_sentiment: lead.reply_sentiment || "",
      }));

      await base44.entities.Lead.bulkCreate(leadsToCreate);
      onImported();
    }

    setLoading(false);
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Import Leads from CSV</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 rounded-lg cursor-pointer hover:border-neutral-400 transition-colors bg-neutral-50">
            <Upload className="w-5 h-5 text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-500">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || loading} className="bg-neutral-900 hover:bg-neutral-800">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}