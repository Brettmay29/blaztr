import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";
import StatsRow from "../components/dashboard/StatsRow";
import LeadFilters from "../components/dashboard/LeadFilters";
import LeadTable from "../components/dashboard/LeadTable";
import ImportLeadsDialog from "../components/dashboard/ImportLeadsDialog";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({ search: "", state: "", industry: "", status: "", market: "" });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 2000),
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const match =
          (l.first_name || "").toLowerCase().includes(s) ||
          (l.email || "").toLowerCase().includes(s) ||
          (l.company_name || "").toLowerCase().includes(s);
        if (!match) return false;
      }
      if (filters.state && l.state !== filters.state) return false;
      if (filters.industry && l.industry !== filters.industry) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (filters.market && l.market !== filters.market) return false;
      return true;
    });
  }, [leads, filters]);

  const handleToggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) =>
      prev.length === filteredLeads.length ? [] : filteredLeads.map((l) => l.id)
    );
  };

  const exportCSV = () => {
    const headers = ["first_name","email","company_name","state","industry","market","status","sequence_type","total_sends","opens","clicks","reply_sentiment"];
    const rows = filteredLeads.map((l) => headers.map((h) => `"${(l[h] ?? "").toString().replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <StatsRow leads={leads} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <LeadFilters filters={filters} onFilterChange={setFilters} leads={leads} />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={exportCSV}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
          <Button
            size="sm"
            className="h-9 text-xs bg-neutral-900 hover:bg-neutral-800"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-neutral-900 text-white text-xs rounded-lg px-4 py-2.5 flex items-center justify-between">
          <span>{selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected</span>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-neutral-400">Loading leads...</div>
      ) : (
        <LeadTable
          leads={filteredLeads}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
        />
      )}

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}
