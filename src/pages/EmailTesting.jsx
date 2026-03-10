import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

export default function EmailTesting() {
  const [form, setForm] = useState({ gmail_account_id: "", to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    const res = await base44.functions.invoke("sendEmail", {
      gmail_account_id: form.gmail_account_id,
      to_email: form.to,
      to_name: form.to,
      subject: form.subject,
      body: form.body,
      lead_id: "test",
      campaign_id: "test",
      template_id: "test",
    });
    setResult(res.data?.success ? "sent" : "error");
    setSending(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Email Testing</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Send a real test email via one of your connected Gmail accounts.</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">From (Gmail Account)</Label>
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
          <Label className="text-xs">To (email address)</Label>
          <Input
            placeholder="recipient@example.com"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input
            placeholder="Test subject line"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Body</Label>
          <Textarea
            placeholder="Write your email body here..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="text-sm min-h-[160px] resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            className="bg-neutral-900 hover:bg-neutral-800 text-xs h-9"
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