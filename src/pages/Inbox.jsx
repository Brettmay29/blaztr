import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Send, Loader2, Mail, MailOpen, ArrowLeft } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function extractName(from) {
  const match = from?.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from || "Unknown";
}

function extractEmail(from) {
  const match = from?.match(/<([^>]+)>/);
  return match ? match[1] : from || "";
}

export default function Inbox() {
  const [selected, setSelected] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyResult, setReplyResult] = useState(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getInboxMessages", {});
      return res.data?.messages || [];
    },
    staleTime: 60000,
  });

  const messages = data || [];

  const handleReply = async () => {
    setReplying(true);
    setReplyResult(null);
    try {
      const res = await base44.functions.invoke("replyToEmail", {
        threadId: selected.threadId,
        to: extractEmail(selected.from),
        subject: selected.subject,
        body: replyBody,
      });
      if (res.data?.success) {
        setReplyResult("sent");
        setReplyBody("");
      } else {
        setReplyResult("error");
      }
    } catch {
      setReplyResult("error");
    } finally {
      setReplying(false);
    }
  };

  if (selected) {
    return (
      <div className="max-w-3xl space-y-4">
        <button
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          onClick={() => { setSelected(null); setReplyBody(""); setReplyResult(null); }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Inbox
        </button>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">{selected.subject || "(no subject)"}</h2>
              {selected.isUnread && <Badge className="bg-blue-50 text-blue-700 text-[11px] shrink-0">Unread</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{extractName(selected.from)}</span>
              <span>&lt;{extractEmail(selected.from)}&gt;</span>
              <span>·</span>
              <span>{formatDate(selected.date)}</span>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed">
              {selected.body || selected.snippet}
            </pre>
          </div>
        </div>

        {/* Reply box */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-3">
          <p className="text-xs font-medium text-neutral-700">
            Reply to {extractName(selected.from)}
          </p>
          <Textarea
            placeholder="Write your reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="text-sm min-h-[120px] resize-none"
          />
          <div className="flex items-center gap-3">
            <Button
              className="bg-neutral-900 hover:bg-neutral-800 text-xs h-9"
              onClick={handleReply}
              disabled={replying || !replyBody.trim()}
            >
              {replying
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Send Reply
            </Button>
            {replyResult === "sent" && (
              <span className="text-xs text-green-600">Reply sent!</span>
            )}
            {replyResult === "error" && (
              <span className="text-xs text-red-500">Failed to send reply.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Inbox</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Replies and incoming emails from your connected Gmail account.</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : messages.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
          <Mail className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">No messages in inbox.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100 overflow-hidden">
          {messages.map((msg) => (
            <button
              key={msg.id}
              className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors flex items-start gap-3"
              onClick={() => { setSelected(msg); setReplyBody(""); setReplyResult(null); }}
            >
              <div className="mt-0.5 shrink-0">
                {msg.isUnread
                  ? <Mail className="w-4 h-4 text-blue-500" />
                  : <MailOpen className="w-4 h-4 text-neutral-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${msg.isUnread ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                    {extractName(msg.from)}
                  </span>
                  <span className="text-[11px] text-neutral-400 shrink-0">{formatDate(msg.date)}</span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${msg.isUnread ? "text-neutral-700" : "text-neutral-400"}`}>
                  {msg.subject || "(no subject)"}
                </p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">{msg.snippet}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}