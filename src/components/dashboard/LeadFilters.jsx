import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LeadFilters({ filters, onFilterChange, leads }) {
  const unique = (field) => [...new Set(leads.map((l) => l[field]).filter(Boolean))].sort();

  const handleChange = (key, val) => {
    onFilterChange({ ...filters, [key]: val === "__all__" ? "" : val });
  };

  const hasActiveFilters = filters.search || filters.state || filters.industry || filters.status || filters.market;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
        <Input
          placeholder="Search leads..."
          value={filters.search || ""}
          onChange={(e) => handleChange("search", e.target.value)}
          className="pl-9 h-9 text-sm bg-white"
        />
      </div>

      <Select value={filters.state || "__all__"} onValueChange={(v) => handleChange("state", v)}>
        <SelectTrigger className="w-[130px] h-9 text-sm bg-white">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All States</SelectItem>
          {unique("state").map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.industry || "__all__"} onValueChange={(v) => handleChange("industry", v)}>
        <SelectTrigger className="w-[140px] h-9 text-sm bg-white">
          <SelectValue placeholder="Industry" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Industries</SelectItem>
          {unique("industry").map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.market || "__all__"} onValueChange={(v) => handleChange("market", v)}>
        <SelectTrigger className="w-[130px] h-9 text-sm bg-white">
          <SelectValue placeholder="Market" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Markets</SelectItem>
          {unique("market").map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status || "__all__"} onValueChange={(v) => handleChange("status", v)}>
        <SelectTrigger className="w-[120px] h-9 text-sm bg-white">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Status</SelectItem>
          {["New", "Pending", "Sent", "Replied", "Bounced", "Opted Out"].map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-neutral-500"
          onClick={() => onFilterChange({ search: "", state: "", industry: "", status: "", market: "" })}
        >
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}