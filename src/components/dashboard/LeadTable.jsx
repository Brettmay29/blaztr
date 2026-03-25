import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles = {
  New: "bg-neutral-100 text-neutral-700",
  Pending: "bg-neutral-200 text-neutral-700",
  Sent: "bg-neutral-800 text-white",
  Replied: "bg-neutral-600 text-white",
  Bounced: "bg-red-100 text-red-700",
  "Opted Out": "bg-neutral-300 text-neutral-600",
};

const sentimentStyles = {
  PR: "bg-green-50 text-green-700 border-green-200",
  NR: "bg-red-50 text-red-700 border-red-200",
  N: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

export default function LeadTable({ leads, selectedIds, onToggle, onToggleAll }) {
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                />
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Email</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Company</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">State</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Industry</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Market</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Seq</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Sends</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Prospect ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Sender Type</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Sender Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Sender Email</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Reply</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-neutral-400 dark:text-neutral-500 py-12 text-sm">
                  No leads found. Import leads to get started.
                </TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                className={cn(
                  "transition-colors cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                  selectedIds.includes(lead.id) && "bg-neutral-50 dark:bg-neutral-800/50"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(lead.id)}
                    onCheckedChange={() => onToggle(lead.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-sm text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                  {lead.first_name}
                </TableCell>
                <TableCell className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">{lead.email}</TableCell>
                <TableCell className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">{lead.company_name}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.state}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.industry}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.market}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[11px] font-medium", statusStyles[lead.status] || statusStyles.New)}>
                    {lead.status || "New"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.sequence_type}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400 text-center">{lead.total_sends || 0}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.prospect_id || <span className="text-neutral-300">—</span>}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.sender_type || <span className="text-neutral-300">—</span>}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.sender_name || <span className="text-neutral-300">—</span>}</TableCell>
                <TableCell className="text-sm text-neutral-500 dark:text-neutral-400">{lead.sender_email || <span className="text-neutral-300">—</span>}</TableCell>
                <TableCell>
                  {lead.reply_sentiment && lead.reply_sentiment !== "" ? (
                    <Badge variant="outline" className={cn("text-[11px]", sentimentStyles[lead.reply_sentiment])}>
                      {lead.reply_sentiment}
                    </Badge>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}