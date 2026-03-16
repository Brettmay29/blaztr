import React from "react";
import { Users, Send, MessageSquare } from "lucide-react";

const stats = [
  { key: "total", label: "Total Leads", icon: Users },
  { key: "sent", label: "Sent", icon: Send },
  { key: "replies", label: "Replies", icon: MessageSquare },
];

export default function StatsRow({ leads }) {
  const data = {
    total: leads.length,
    sent: leads.filter((l) => l.status === "Sent" || l.status === "Replied").length,
    replies: leads.filter((l) => l.reply_sentiment === "PR" || l.reply_sentiment === "NR").length,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.key} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <s.icon className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 leading-none">{data[s.key]}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
