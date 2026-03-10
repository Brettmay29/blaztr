import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Link, FileSpreadsheet, Trash2, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, Database } from "lucide-react";
import LeadTable from "../components/dashboard/LeadTable";
import LeadFilters from "../components/dashboard/LeadFilters";

export default function LeadsDatabase() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("csv");
  const [sheetUrl, setSheetUrl] = useState("");
  const [dbName, setDbName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [filters, setFilters] = useState({ search: "", state: "", industry: "", status: "", market: "" });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["leadsGroups"],
    queryFn: () => base44.entities.LeadsGroup.list("-created_date", 100),
  });

  const groupLeads = selectedGroupId === "all" ? leads : leads.filter((l) => l.group_id === selectedGroupId);

  const filteredLeads = groupLeads.filter((l) => {
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

  const handleToggle = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleToggleAll = () =>
    setSelectedIds((prev) => prev.length === filteredLeads.length ? [] : filteredLeads.map((l) => l.id));

  const parseCSVRow = (row) => {
    const values = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return values;
  };

  const mapRowToLead = (headers, values, groupId) => {
    const row = {};
    headers.forEach((h, i) => { row[h.toLowerCase().replace(/\s+/g, "_")] = values[i] || ""; });
    return {
      first_name: row.first_name || row.name || row.firstname || "",
      email: row.email || row.email_address || "",
      company_name: row.company_name || row.company || row.business_name || "",
      state: row.state || "",
      industry: row.industry || "",
      market: row.market || "",
      status: "New",
      sequence_type: "1st",
      total_sends: 0,
      opens: 0,
      clicks: 0,
      group_id: groupId,
    };
  };

  const doImport = async (lines, source) => {
    const name = dbName.trim() || `${source} Import ${new Date().toLocaleDateString()}`;
    const headers = parseCSVRow(lines[0]);
    const rows = lines.slice(1).map((l) => mapRowToLead(headers, parseCSVRow(l), "__PENDING__")).filter((r) => r.email);

    if (rows.length === 0) {
      setImportStatus({ type: "error", message: "No valid leads found. Make sure there is an 'email' column." });
      return;
    }

    // Create group first
    const group = await base44.entities.LeadsGroup.create({ name, source, lead_count: rows.length });
    const rowsWithGroup = rows.map((r) => ({ ...r, group_id: group.id }));
    await base44.entities.Lead.bulkCreate(rowsWithGroup);

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setImportStatus({ type: "success", message: `Imported ${rows.length} leads into "${name}".` });
    setSelectedGroupId(group.id);
    setDbName("");
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      setImportStatus({ type: "error", message: "CSV appears empty or has no data rows." });
      setImporting(false);
      return;
    }
    await doImport(lines, "CSV");
    setImporting(false);
    e.target.value = "";
  };

  const handleSheetImport = async () => {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      setImportStatus({ type: "error", message: "Invalid Google Sheet URL." });
      return;
    }
    setImporting(true);
    setImportStatus(null);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      setImportStatus({ type: "error", message: "Could not access sheet. Make sure it's set to 'Anyone with the link can view'." });
      setImporting(false);
      return;
    }
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      setImportStatus({ type: "error", message: "Sheet appears empty." });
      setImporting(false);
      return;
    }
    await doImport(lines, "Google Sheet");
    setImporting(false);
    setSheetUrl("");
  };

  const handleDeleteSelected = async () => {
    await Promise.all(selectedIds.map((id) => base44.entities.Lead.delete(id)));
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    setSelectedIds([]);
  };

  const selectedGroupName = selectedGroupId === "all"
    ? "All Databases"
    : groups.find((g) => g.id === selectedGroupId)?.name || "Unknown";

  return (
    <div className="space-y-5">
      {/* Import Panel */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Import Leads</h2>

            {/* Tabs */}
            <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setTab("csv")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === "csv" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <button
                onClick={() => setTab("sheet")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === "sheet" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                Google Sheet
              </button>
            </div>

            {/* Database name input */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Database name (optional, e.g. HVAC Texas Q1)"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                className="text-sm h-9 max-w-xs"
              />
            </div>

            {tab === "csv" && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? "Importing..." : "Choose CSV File"}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={importing} />
                </label>
                <p className="text-xs text-neutral-400">
                  Required: <span className="font-mono bg-neutral-100 px-1 rounded">email</span>.
                  Optional: <span className="font-mono bg-neutral-100 px-1 rounded">first_name</span>,{" "}
                  <span className="font-mono bg-neutral-100 px-1 rounded">company_name</span>,{" "}
                  <span className="font-mono bg-neutral-100 px-1 rounded">state</span>,{" "}
                  <span className="font-mono bg-neutral-100 px-1 rounded">industry</span>,{" "}
                  <span className="font-mono bg-neutral-100 px-1 rounded">market</span>
                </p>
              </div>
            )}

            {tab === "sheet" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="text-sm h-9 flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-9 bg-neutral-900 hover:bg-neutral-800 text-xs shrink-0"
                    onClick={handleSheetImport}
                    disabled={importing || !sheetUrl.trim()}
                  >
                    {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Import"}
                  </Button>
                </div>
                <p className="text-xs text-neutral-400">
                  Sheet must be shared as <strong>"Anyone with the link can view"</strong>.
                </p>
              </div>
            )}

            {importStatus && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                importStatus.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {importStatus.type === "success"
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {importStatus.message}
              </div>
            )}
          </div>

          {/* Uploaded Databases Dropdown */}
          <div className="sm:w-56 shrink-0">
            <p className="text-xs font-medium text-neutral-500 mb-1.5">Uploaded Databases</p>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="h-9 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Database className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{selectedGroupName}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Databases</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="truncate">{g.name}</span>
                      <span className="text-neutral-400 text-xs shrink-0">{g.lead_count}</span>
                    </div>
                  </SelectItem>
                ))}
                {groups.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-400">No databases yet</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <LeadFilters filters={filters} onFilterChange={setFilters} leads={groupLeads} />
        <span className="text-xs text-neutral-400 shrink-0">
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
          {selectedGroupId !== "all" && <span className="ml-1 text-neutral-300">in "{selectedGroupName}"</span>}
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-neutral-900 text-white text-xs rounded-lg px-4 py-2.5 flex items-center justify-between">
          <span>{selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDeleteSelected}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
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
    </div>
  );
}