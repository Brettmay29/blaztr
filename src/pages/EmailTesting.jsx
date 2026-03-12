import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, CheckCircle2, Code2 } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const isBodyEmpty = (val) => !val || val === "<p><br></p>" || val.replace(/<[^>]*>/g, "").trim() === "";

export default function EmailTesting() {
  const [form, setForm] = useState({ gmail_account_id: "", to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const quillRef = useRef(null);

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("sendEmail", {
        gmail_account_id: form.gmail_account_id,
        to: form.to,
        subject: form.subject,
        body: form.body,
      });
      setResult(res.data?.success ? "sent" : "error");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Email Testing</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Send a real test email via one of your connected Gmail accounts.</p>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs dark:text-neutral-400">From (Gmail Account)</Label>
          <Select value={form.gmail_account_id} onValueChange={(v) => setForm({ ...form, gmail_account_id: v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {gmailAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.nickname} ({acc.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs dark:text-neutral-400">To (email address)</Label>
          <Input
            placeholder="recipient@example.com"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs dark:text-neutral-400">Subject</Label>
          <Input
            placeholder="Test subject line"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs dark:text-neutral-400">Body</Label>

          {isMarkdownMode ? (
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write your email body here..."
              className="w-full h-48 p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <ReactQuill
                ref={quillRef}
                value={form.body}
                onChange={(value) => setForm({ ...form, body: value })}
                theme="snow"
                placeholder="Write your email body here..."
                modules={{
                  toolbar: [
                    [{ font: ["arial", "courier", "georgia", "helvetica", "tahoma", "times-new-roman", "trebuchet", "verdana"] }],
                    [{ size: ["small", false, "large", "huge"] }],
                    ["bold", "italic", "underline"],
                    ["link"],
                    [{ list: "ordered" }, { list: "bullet" }],
                  ],
                }}
                formats={["font", "size", "bold", "italic", "underline", "link", "list"]}
                style={{ height: "200px" }}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 border border-t-0 border-neutral-200 dark:border-neutral-700 rounded-b-lg bg-neutral-50 dark:bg-neutral-800">
            <Button
              size="sm"
              variant={isMarkdownMode ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            >
              <Code2 className="w-3.5 h-3.5 mr-1" />
              {isMarkdownMode ? "Markdown" : "Rich Text"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            className="bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs h-9"
            onClick={handleSend}
            disabled={sending || !form.gmail_account_id || !form.to || !form.subject || !form.body}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Send Test
          </Button>
          {result === "sent" && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Email sent successfully!
            </div>
          )}
          {result === "error" && (
            <p className="text-xs text-red-500">Failed to send. Check your Gmail connection.</p>
          )}
        </div>
      </div>
    </div>
  );
}