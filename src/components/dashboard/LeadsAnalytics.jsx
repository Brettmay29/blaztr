import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#171717", "#525252", "#a3a3a3", "#d4d4d4", "#e5e5e5"];

export default function LeadsAnalytics() {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["leadsGroups"],
    queryFn: () => base44.entities.LeadsGroup.list("-created_date", 100),
  });

  // Status breakdown
  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Industry breakdown (top 8)
  const industryCounts = leads.reduce((acc, l) => {
    if (l.industry) acc[l.industry] = (acc[l.industry] || 0) + 1;
    return acc;
  }, {});
  const industryData = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // State breakdown (top 10)
  const stateCounts = leads.reduce((acc, l) => {
    if (l.state) acc[l.state] = (acc[l.state] || 0) + 1;
    return acc;
  }, {});
  const stateData = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // Sentiment breakdown
  const sentimentMap = { PR: "Positive Reply", NR: "Negative Reply", N: "Neutral", "": "None" };
  const sentimentCounts = leads.reduce((acc, l) => {
    const key = sentimentMap[l.reply_sentiment] || "None";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sentimentData = Object.entries(sentimentCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const totalLeads = leads.length;
  const totalSent = leads.filter((l) => l.status === "Sent" || l.total_sends > 0).length;
  const totalReplied = leads.filter((l) => l.status === "Replied").length;
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0.0";

  const StatCard = ({ label, value, sub }) => (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads.toLocaleString()} />
        <StatCard label="Total Databases" value={groups.length} />
        <StatCard label="Leads Sent To" value={totalSent.toLocaleString()} />
        <StatCard label="Reply Rate" value={`${replyRate}%`} sub={`${totalReplied} replies`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Status */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-4">Leads by Status</p>
          {statusData.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sentiment */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-4">Reply Sentiment</p>
          {sentimentData.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {sentimentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Industry */}
        {industryData.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-4">Top Industries</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={industryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#171717" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* States */}
        {stateData.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-4">Top States</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stateData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#525252" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}