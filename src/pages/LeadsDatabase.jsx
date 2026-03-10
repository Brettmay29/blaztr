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
import { Upload, Link, FileSpreadsheet, Trash2, RefreshCw, CheckCircle2, AlertCircle, Database, X } from "lucide-react";
import LeadTable from "../components/dashboard/LeadTable";
import LeadFilters from "../components/dashboard/LeadFilters";
import ColumnMapper from "../components/dashboard/ColumnMapper";

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
  const [customDbName, setCustomDbName] = useState("");
  const [customGroupId, setCustomGroupId] = useState("all");
  const [moveToGroupId, setMoveToGroupId] = useState("");
  const [lastUploadedGroupId, setLastUploadedGroupId] = useState("all");

  // Column mapping state
  const [pendingImport, setPendingImport] = useState(null); // { columns, dataRows, source, name }

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["leadsGroups"],
    queryFn: () => base44.entities.LeadsGroup.list("-created_date", 100),
  });

  const activeGroupId = customGroupId !== "all" ? customGroupId : selectedGroupId;
  const groupLeads = activeGroupId === "all" ? leads : leads.filter((l) => l.group_id === activeGroupId);

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

  // Parse lines and show the column mapper
  const prepareImport = (lines, source) => {
    const name = dbName.trim() || `${source} Import ${new Date().toLocaleDateString()}`;
    const columns = parseCSVRow(lines[0]);
    const dataRows = lines.slice(1).map((l) => parseCSVRow(l));
    setPendingImport({ columns, dataRows, source, name });
  };

  // Called after user confirms column mapping
  const handleMappingConfirm = async (mapping) => {
    const { columns, dataRows, source, name } = pendingImport;
    setPendingImport(null);
    setImporting(true);
    setImportStatus(null);

    const rows = dataRows
      .map((values) => {
        const lead = {
          status: "New",
          sequence_type: "1st",
          total_sends: 0,
          opens: 0,
          clicks: 0,
        };
        columns.forEach((col, i) => {
          const field = mapping[col];
          if (field && field !== "__skip__") {
            lead[field] = values[i] || "";
          }
        });
        return lead;
      })
      .filter((r) => r.email);

    if (rows.length === 0) {
      setImportStatus({ type: "error", message: "No valid leads found — the Email column may be empty." });
      setImporting(false);
      return;
    }

    const group = await base44.entities.LeadsGroup.create({ name, source, lead_count: rows.length });
    const rowsWithGroup = rows.map((r) => ({ ...r, group_id: group.id }));
    await base44.entities.Lead.bulkCreate(rowsWithGroup);

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setImportStatus({ type: "success", message: `Imported ${rows.length} leads into "${name}".` });
    setSelectedGroupId(group.id);
    setDbName("");
    setImporting(false);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus(null);
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      setImportStatus({ type: "error", message: "CSV appears empty or has no data rows." });
      return;
    }
    prepareImport(lines, "CSV");
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
    setImporting(false);
    prepareImport(lines, "Google Sheet");
    setSheetUrl("");
  };

  const handleDeleteSelected = async () => {
    await Promise.all(selectedIds.map((id) => base44.entities.Lead.delete(id)));
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    setSelectedIds([]);
  };

  const uploadedGroups = groups.filter((g) => !g.type || g.type === "uploaded");
  const customGroups = groups.filter((g) => g.type === "custom");

  const selectedGroupName = activeGroupId === "all"
    ? "All Databases"
    : groups.find((g) => g.id === activeGroupId)?.name || "Unknown";

  const handleDeleteGroup = async () => {
    if (selectedGroupId === "all") return;
    const groupLeadsToDelete = leads.filter((l) => l.group_id === selectedGroupId);
    await Promise.all(groupLeadsToDelete.map((l) => base44.entities.Lead.delete(l.id)));
    await base44.entities.LeadsGroup.delete(selectedGroupId);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setSelectedGroupId("all");
  };

  const handleCreateCustomGroup = async () => {
    if (!customDbName.trim()) return;
    const group = await base44.entities.LeadsGroup.create({ name: customDbName.trim(), source: "CSV", lead_count: 0, type: "custom" });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setCustomDbName("");
    setCustomGroupId(group.id);
  };

  const handleDeleteCustomGroup = async () => {
    if (!customGroupId || customGroupId === "all") return;
    const groupLeadsToDelete = leads.filter((l) => l.group_id === customGroupId);
    await Promise.all(groupLeadsToDelete.map((l) => base44.entities.Lead.delete(l.id)));
    await base44.entities.LeadsGroup.delete(customGroupId);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setCustomGroupId("all");
  };

  const handleMoveSelected = async () => {
    if (!moveToGroupId) return;
    for (const id of selectedIds) {
      await base44.entities.Lead.update(id, { group_id: moveToGroupId });
    }
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadsGroups"] });
    setSelectedIds([]);
    // Track the source uploaded group before navigating
    const sourceGroup = groups.find((g) => g.id === activeGroupId);
    if (sourceGroup && sourceGroup.type !== "custom") {
      setLastUploadedGroupId(activeGroupId);
    }
    // Navigate to the destination group so the user can see the moved leads
    const destGroup = groups.find((g) => g.id === moveToGroupId);
    if (destGroup?.type === "custom") {
      setCustomGroupId(moveToGroupId);
      setSelectedGroupId("all");
    } else {
      setSelectedGroupId(moveToGroupId);
      setCustomGroupId("all");
    }
    setMoveToGroupId("");
  };

  return (
    <div className="space-y-5">
      {/* Column Mapper Modal */}
      {pendingImport && (
        <ColumnMapper
          columns={pendingImport.columns}
          previewRows={pendingImport.dataRows.slice(0, 3)}
          onConfirm={handleMappingConfirm}
          onCancel={() => setPendingImport(null)}
        />
      )}

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
            <Input
              placeholder="Database name (optional, e.g. HVAC Texas Q1)"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              className="text-sm h-9 max-w-xs"
            />

            {tab === "csv" && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? "Importing..." : "Choose CSV File"}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={importing} />
                </label>
                <p className="text-xs text-neutral-400">You'll map columns after selecting the file.</p>
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
                  Sheet must be shared as <strong>"Anyone with the link can view"</strong>. You'll map columns next.
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

          {/* Right column: Uploaded Databases + Custom Database */}
          <div className="sm:w-56 shrink-0 space-y-3">
            {/* Uploaded Databases */}
            <div className={customGroupId !== "all" ? "opacity-40 pointer-events-none" : ""}>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">Uploaded Databases</p>
              <div className="flex items-center gap-1.5">
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">
                        {customGroupId !== "all"
                          ? (lastUploadedGroupId !== "all" ? (groups.find((g) => g.id === lastUploadedGroupId)?.name || "All Databases") : "All Databases")
                          : selectedGroupName}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Databases</SelectItem>
                    {uploadedGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="truncate">{g.name}</span>
                          <span className="text-neutral-400 text-xs shrink-0">{g.lead_count}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {uploadedGroups.length === 0 && (
                      <div className="px-3 py-2 text-xs text-neutral-400">No databases yet</div>
                    )}
                  </SelectContent>
                </Select>
                {selectedGroupId !== "all" && (
                  <button
                    onClick={handleDeleteGroup}
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-300 transition-colors"
                    title="Delete this database"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Custom Database */}
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">Custom Database</p>
              <div className="flex items-center gap-1.5">
                <Select
                  value={customGroupId}
                  onValueChange={(val) => {
                    if (val === "all") {
                      setCustomGroupId("all");
                    } else {
                      setCustomGroupId(val);
                      setSelectedGroupId("all");
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">
                        {customGroupId === "all" ? "Select folder..." : groups.find((g) => g.id === customGroupId)?.name || "Select folder..."}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— None —</SelectItem>
                    {customGroups.map((g) => (
                      <SelectItem
                        key={g.id}
                        value={g.id}
                        onPointerDown={(e) => {
                          if (g.id === customGroupId) {
                            e.preventDefault();
                            setCustomGroupId("all");
                          }
                        }}
                      >
                        {g.name}
                      </SelectItem>
                    ))}
                    {customGroups.length === 0 && (
                      <div className="px-3 py-2 text-xs text-neutral-400">No custom folders yet</div>
                    )}
                  </SelectContent>
                </Select>
                {customGroupId !== "all" && (
                  <button
                    onClick={handleDeleteCustomGroup}
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-300 transition-colors"
                    title="Delete this database"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Create new custom database */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <Input
                  placeholder="New folder name..."
                  value={customDbName}
                  onChange={(e) => setCustomDbName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCustomGroup()}
                  className="h-9 text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-9 px-3 text-xs bg-neutral-900 hover:bg-neutral-800 shrink-0"
                  onClick={handleCreateCustomGroup}
                  disabled={!customDbName.trim()}
                >
                  +
                </Button>
              </div>
            </div>
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
        <div className="bg-neutral-900 text-white text-xs rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="shrink-0">{selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected</span>
          {/* Move to */}
          <span className="text-neutral-400 shrink-0">Move to:</span>
          <div className="flex items-center gap-1.5">
            <Select value={moveToGroupId} onValueChange={setMoveToGroupId}>
              <SelectTrigger className="h-7 text-xs bg-neutral-800 border-neutral-700 text-white w-36">
                <SelectValue placeholder="Select folder..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.name}
                  </SelectItem>
                ))}
                {groups.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-400">No databases yet</div>
                )}
              </SelectContent>

            </Select>
            <Button
              size="sm"
              className="h-7 text-xs bg-neutral-700 hover:bg-neutral-600 shrink-0"
              onClick={handleMoveSelected}
              disabled={!moveToGroupId}
            >
              Move
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
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