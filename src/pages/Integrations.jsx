import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ExternalLink, Plug } from "lucide-react";

const integrations = [
  {
    name: "Zapier",
    description: "Automate workflows by connecting Blaztbot with 5,000+ apps.",
    category: "Automation",
    logo: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=48&h=48&fit=crop",
    color: "bg-orange-50 border-orange-200",
    badgeColor: "bg-orange-100 text-orange-700",
    connected: false,
    url: "https://zapier.com",
  },
  {
    name: "n8n",
    description: "Open-source workflow automation to build complex integrations.",
    category: "Automation",
    logo: null,
    emoji: "⚙️",
    color: "bg-pink-50 border-pink-200",
    badgeColor: "bg-pink-100 text-pink-700",
    connected: false,
    url: "https://n8n.io",
  },
  {
    name: "Claude (Anthropic)",
    description: "Use Claude AI to enhance email personalization and content generation.",
    category: "AI",
    logo: null,
    emoji: "🤖",
    color: "bg-purple-50 border-purple-200",
    badgeColor: "bg-purple-100 text-purple-700",
    connected: false,
    url: "https://anthropic.com",
  },
  {
    name: "OpenAI",
    description: "Power AI-driven features with GPT models for smarter outreach.",
    category: "AI",
    logo: null,
    emoji: "🧠",
    color: "bg-green-50 border-green-200",
    badgeColor: "bg-green-100 text-green-700",
    connected: false,
    url: "https://openai.com",
  },
  {
    name: "Gmail",
    description: "Send emails directly through your connected Gmail accounts.",
    category: "Email",
    logo: null,
    emoji: "📧",
    color: "bg-red-50 border-red-200",
    badgeColor: "bg-red-100 text-red-700",
    connected: true,
    url: null,
  },
  {
    name: "Google Sheets",
    description: "Import leads directly from Google Sheets into your database.",
    category: "Data",
    logo: null,
    emoji: "📊",
    color: "bg-emerald-50 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-700",
    connected: false,
    url: "https://sheets.google.com",
  },
  {
    name: "Slack",
    description: "Get real-time notifications for replies, opens, and campaign updates.",
    category: "Notifications",
    logo: null,
    emoji: "💬",
    color: "bg-yellow-50 border-yellow-200",
    badgeColor: "bg-yellow-100 text-yellow-700",
    connected: false,
    url: "https://slack.com",
  },
  {
    name: "HubSpot",
    description: "Sync leads and campaign activity with your HubSpot CRM.",
    category: "CRM",
    logo: null,
    emoji: "🔶",
    color: "bg-orange-50 border-orange-200",
    badgeColor: "bg-orange-100 text-orange-700",
    connected: false,
    url: "https://hubspot.com",
  },
  {
    name: "Salesforce",
    description: "Push leads and engagement data directly into Salesforce.",
    category: "CRM",
    logo: null,
    emoji: "☁️",
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-700",
    connected: false,
    url: "https://salesforce.com",
  },
  {
    name: "Webhooks",
    description: "Send real-time event data to any custom URL or external service.",
    category: "Developer",
    logo: null,
    emoji: "🔗",
    color: "bg-neutral-50 border-neutral-200",
    badgeColor: "bg-neutral-100 text-neutral-700",
    connected: false,
    url: null,
  },
];

const categories = ["All", "Automation", "AI", "Email", "CRM", "Data", "Notifications", "Developer"];

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = activeCategory === "All"
    ? integrations
    : integrations.filter((i) => i.category === activeCategory);

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Integrations</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Connect your favorite tools to supercharge your outreach.
          </p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-0 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {connectedCount} Connected
        </Badge>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "bg-neutral-900 text-white"
                : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((integration) => (
          <div
            key={integration.name}
            className={`rounded-xl border p-5 flex flex-col gap-3 ${integration.color}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-white/60 shadow-sm flex items-center justify-center text-xl">
                  {integration.emoji || <Plug className="w-5 h-5 text-neutral-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{integration.name}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${integration.badgeColor}`}>
                    {integration.category}
                  </span>
                </div>
              </div>
              {integration.connected ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-300 mt-0.5 flex-shrink-0" />
              )}
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">{integration.description}</p>

            <div className="mt-auto">
              {integration.connected ? (
                <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-white" disabled>
                  <CheckCircle2 className="w-3 h-3 mr-1.5 text-green-500" /> Connected
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 bg-white hover:bg-neutral-50"
                  onClick={() => integration.url && window.open(integration.url, "_blank")}
                >
                  Connect
                  {integration.url && <ExternalLink className="w-3 h-3 ml-1.5" />}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}