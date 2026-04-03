import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, Send, Loader2, Mail, MailOpen, ArrowLeft, ChevronDown, Check } from "lucide-react";

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

// Helper to detect if a string contains HTML tags
function isHtmlContent(str) {
  if (!str) return false;
  return /<\/?(?:div|p|br|span|table|tr|td|th|ul|ol|li|h[1-6]|a|img|b|i|em|strong|font|blockquote|hr)\b/i.test(str);
}

export default function Inbox() {
  const [selected, setSelected] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyResult, setReplyResult] = useState(null);
  const [mode, setMode] = useState("all");
  const [singleAccount, setSingleAccount] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectOpen, setSelectOpen] = useState(false);

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmailAccounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getInboxMessages", {});
      return res.data?.messages || [];
    },
    staleTime: 60000,
  });

  const allMessages = data || [];

  const messages = useMemo(() => {
    if (mode === "all") return allMessages;
    const filterEmails = mode === "single" ? (singleAccount ? [singleAccount] : []) : selectedAccounts;
    if (!filterEmails.length) return allMessages;
    return allMessages.filter((msg) => {
      const toEmail = extractEmail(msg.to).toLowerCase();
      return filterEmails.some((e) => e.toLowerCase() === toEmail);
    });
  }, [allMessages, mode, singleAccount, selectedAccounts]);

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

  const dropdownLabel = useMemo(() => {
    if (mode === "all") return "All Inboxes";
    if (mode === "single") return singleAccount || "Select account";
    if (mode === "select") {
      if (!selectedAccounts.length) return "Select Inboxes";
      if (selectedAccounts.length === 1) return selectedAccounts[0];
      return `${selectedAccounts.length} inboxes`;
    }
  }, [mode, singleAccount, selectedAccounts]);

  const toggleSelectAccount = (email) => {
    setSelectedAccounts((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  if (selected) {
    return (
      <div className="max-w-3xl space-y-4">
        <button
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          onClick={() => { setSelected(null); setReplyBody(""); setReplyResult(null); }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Inbox
        </button>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{selected.subject || "(no subject)"}</h2>
              {selected.isUnread && <Badge className="bg-blue-50 text-blue-700 text-[11px] shrink-0">Unread</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700">{extractName(selected.from)}</span>
              <span>&lt;{extractEmail(selected.from)}&gt;</span>
              <span>·</span>
              <span>{formatDate(selected.date)}</span>
            </div>
            {selected.to && (
              <p className="text-xs text-neutral-400 mt-0.5">To: {selected.to}</p>
            )}
          </div>

          {/* Email body — render HTML if detected, otherwise plain text */}
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            {isHtmlContent(selected.body) ? (
              <div
                className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed max-w-none [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_table]:border-collapse"
                dangerouslySetInnerHTML={{ __html: selected.body }}
              />
            ) : (
              <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                {selected.body || selected.snippet}
              </pre>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 space-y-3">
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
              {replying ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Send Reply
            </Button>
            {replyResult === "sent" && <span className="text-xs text-green-600">Reply sent!</span>}
            {replyResult === "error" && <span className="text-xs text-red-500">Failed to send reply.</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Inbox</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Incoming emails from your connected Gmail accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu open={selectOpen} onOpenChange={setSelectOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 max-w-[220px] truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{dropdownLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                className="text-xs flex items-center gap-2 cursor-pointer"
                onClick={() => { setMode("all"); setSelectOpen(false); }}
              >
                {mode === "all" && <Check className="w-3.5 h-3.5 text-neutral-800" />}
                {mode !== "all" && <span className="w-3.5" />}
                All Inboxes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-neutral-400 font-normal">Single account</DropdownMenuLabel>
              {gmailAccounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  className="text-xs flex items-center gap-2 cursor-pointer"
                  onClick={() => { setMode("single"); setSingleAccount(acc.email); setSelectOpen(false); }}
                >
                  {mode === "single" && singleAccount === acc.email ? <Check className="w-3.5 h-3.5 text-neutral-800" /> : <span className="w-3.5" />}
                  <span className="truncate">{acc.nickname || acc.email}</span>
                  <span className="text-neutral-400 truncate ml-auto text-[11px]">{acc.email}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-neutral-400 font-normal">Select inboxes</DropdownMenuLabel>
              {gmailAccounts.map((acc) => (
                <DropdownMenuCheckboxItem
                  key={`chk-${acc.id}`}
                  className="text-xs cursor-pointer"
                  checked={selectedAccounts.includes(acc.email)}
                  onCheckedChange={() => { setMode("select"); toggleSelectAccount(acc.email); }}
                >
                  <span className="truncate">{acc.nickname || acc.email}</span>
                </DropdownMenuCheckboxItem>
              ))}
              {gmailAccounts.length === 0 && (
                <DropdownMenuItem disabled className="text-xs text-neutral-400">No accounts connected</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : messages.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-12 text-center">
          <Mail className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">No messages found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
          {messages.map((msg) => (
            <button
              key={msg.id}
              className="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-start gap-3"
              onClick={() => { setSelected(msg); setReplyBody(""); setReplyResult(null); }}
            >
              <div className="mt-0.5 shrink-0">
                {msg.isUnread ? <Mail className="w-4 h-4 text-blue-500" /> : <MailOpen className="w-4 h-4 text-neutral-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${msg.isUnread ? "font-semibold text-neutral-900 dark:text-white" : "font-medium text-neutral-700 dark:text-neutral-300"}`}>
                    {extractName(msg.from)}
                  </span>
                  <span className="text-[11px] text-neutral-400 shrink-0">{formatDate(msg.date)}</span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${msg.isUnread ? "text-neutral-700" : "text-neutral-400"}`}>
                  {msg.subject || "(no subject)"}
                </p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">{msg.snippet}</p>
              </div>
              {msg.to && (
                <span className="text-[11px] text-neutral-400 shrink-0 hidden sm:block mt-0.5">{extractEmail(msg.to)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
