import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const LEAD_FIELDS = [
  { value: "__skip__", label: "— Skip this column —" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "company_name", label: "Company Name" },
  { value: "state", label: "State" },
  { value: "industry", label: "Industry" },
  { value: "market", label: "Market" },
  { value: "company_website", label: "Website" },
  { value: "alternate_emails", label: "Alternate Email" },
  { value: "prospect_id", label: "Prospect ID" },
  { value: "sender_type", label: "Sender Type" },
  { value: "sender_name", label: "Sender Name" },
  { value: "sender_email", label: "Sender Email" },
];

function guessMapping(colName) {
  const n = colName.toLowerCase().trim().replace(/[\s\-\.]+/g, "_");
  if (["email", "email_address", "e_mail", "mail"].includes(n)) return "email";
  if (["first_name", "firstname", "first", "name", "contact_name", "contact"].includes(n)) return "first_name";
  if (["last_name", "lastname", "last", "surname", "family_name"].includes(n)) return "last_name";
  if (["company_name", "company", "business_name", "business", "organization", "org"].includes(n)) return "company_name";
  if (["state", "province", "region", "st"].includes(n)) return "state";
  if (["industry", "sector", "vertical", "niche"].includes(n)) return "industry";
  if (["market", "market_type", "segment", "type"].includes(n)) return "market";
  if (["company_website", "website", "url", "web", "site"].includes(n)) return "company_website";
  if (["alternate_emails", "alternate_email", "alt_email", "other_email"].includes(n)) return "alternate_emails";
  if (["prospect_id", "prospectid", "prospect"].includes(n)) return "prospect_id";
  if (["sender_type", "sendertype"].includes(n)) return "sender_type";
  if (["sender_name", "sendername"].includes(n)) return "sender_name";
  if (["sender_email", "senderemail"].includes(n)) return "sender_email";
  return "__skip__";
}

export default function ColumnMapper({ columns, previewRows, onConfirm, onCancel }) {
  const [mapping, setMapping] = useState(() => {
    const m = {};
    columns.forEach((col) => { m[col] = guessMapping(col); });
    return m;
  });

  const hasEmail = Object.values(mapping).includes("email");

  const handleConfirm = () => {
    onConfirm(mapping);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Map Columns</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Match each column from your file to a field in the app. Unmatched columns will be skipped.
          </p>
        </div>

        {/* Column rows */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {columns.map((col) => (
            <div key={col} className="flex items-center gap-3">
              <div className="w-44 shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-md px-3 py-2 text-xs font-mono text-neutral-700 dark:text-neutral-300 truncate">
                {col}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
              <Select
                value={mapping[col]}
                onValueChange={(val) => setMapping((prev) => ({ ...prev, [col]: val }))}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Preview rows */}
        {previewRows.length > 0 && (
          <div className="px-6 pb-3">
            <p className="text-[11px] text-neutral-400 mb-1.5">Preview (first 3 rows)</p>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
              <table className="text-[11px] w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left text-neutral-500 dark:text-neutral-400 font-medium whitespace-nowrap border-r border-neutral-200 dark:border-neutral-700 last:border-r-0">
                        {mapping[col] !== "__skip__"
                          ? LEAD_FIELDS.find((f) => f.value === mapping[col])?.label
                          : <span className="text-neutral-300 dark:text-neutral-600">skip</span>
                        }
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                      {columns.map((col, j) => (
                        <td key={j} className={`px-2 py-1.5 whitespace-nowrap border-r border-neutral-100 dark:border-neutral-800 last:border-r-0 ${mapping[col] === "__skip__" ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-700 dark:text-neutral-300"}`}>
                          {row[j] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
          {!hasEmail && (
            <p className="text-xs text-red-500">You must map at least one column to <strong>Email</strong>.</p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={handleConfirm}
              disabled={!hasEmail}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Confirm & Import
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}