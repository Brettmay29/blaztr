import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const industryCounts = leads.reduce((acc, l) => {
    if (l.industry) acc[l.industry] = (acc[l.industry] || 0) + 1;
    return acc;
  }, {});
  const industryData = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const stateCounts = leads.reduce((acc, l) => {
    if (l.state) acc[l.state] = (acc[l.state] || 0) + 1;
    return acc;
  }, {});
  const stateData = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const sentimentMap = { PR: "Positive Reply", NR: "Negat
