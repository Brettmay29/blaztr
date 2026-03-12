import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Loader2, CheckCircle2, ChevronDown, Eye } from "lucide-react";

const isBodyEmpty = (val) => !val || val === "<p><br></p>" || val.replace(/<[^>]*>/g, "").trim() === "";

const VARIABLES = [
  { name: "{{firstName}}", label: "First Name" },
  { name: "{{lastName}}", label: "Last Name" },
  { name: "{{email}}", label: "Email" },
  { name: "{{companyName}}", label: "Company Name" },
  { name: "{{companyWebsite}}", label: "Company Website" },
  { name: "{{industry}}", label: "Industry" },
  { name: "{{state}}", label: "State" },
  { name: "{{market}}", label: "Market" },
  { name: "{{senderFirstName}}", label: "Sender First Name" },
  { name: "{{senderLastName}}", label: "Sender Last Name" },
  { name: "{{senderSignature}}", label: "Sender Signature" },
];

export default function EmailTesting() {
   const [form, setForm] = useState({ gmail_account_id: "", to: "", subject: "", body: "", lead_id: "" });
   const [sending, setSending] = useState(false);
   const [result, setResult] = useState(null);
   const [showVariables, setShowVariables] = useState(false);
   const [hoveredVar, setHoveredVar] = useState(null);
   const [showPreview, setShowPreview] = useState(false);

   const { data: gmailAccounts = [] } = useQuery({
     queryKey: ["gmail_accounts"],
     queryFn: () => base44.entities.GmailAccount.list(),
   });

   const { data: leads = [] } = useQuery({
      queryKey: ["leads"],
      queryFn: () => base44.entities.Lead.list(),
    });

   const { data: gmailAccountData } = useQuery({
      queryKey: ["gmail_account", form.gmail_account_id],
      queryFn: () => form.gmail_account_id ? base44.entities.GmailAccount.get(form.gmail_account_id) : null,
      enabled: !!form.gmail_account_id,
    });

   const { data: leadData } = useQuery({
      queryKey: ["lead", form.lead_id],
      queryFn: () => form.lead_id ? base44.entities.Lead.get(form.lead_id) : null,
      enabled: !!form.lead_id,
    });

   const insertVariable = (varName) => {
      setForm({ ...form, body: form.body + varName + " " });
      setShowVariables(false);
   };

   const stripHTML = (text) => {
      if (!text) return text;
      return text
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<div>/g, '')
        .replace(/<\/div>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
   };

   const replaceVariables = (text) => {
      if (!text) return text;
      let result = text;

      const sampleLead = {
        first_name: leadData?.first_name || 'John',
        last_name: leadData?.last_name || 'Doe',
        email: leadData?.email || 'john@example.com',
        company_name: leadData?.company_name || 'Acme Corp',
        company_website: leadData?.company_website || 'acme.com',
        industry: leadData?.industry || 'Technology',
        state: leadData?.state || 'NY',
        market: leadData?.market || 'Enterprise',
      };

      const sampleSender = {
        first_name: gmailAccountData?.first_name || '',
        last_name: gmailAccountData?.last_name || '',
        signature: gmailAccountData?.signature || '',
      };

      result = result.replace(/\{\{firstName\}\}/gi, sampleLead.first_name);
      result = result.replace(/\{\{lastName\}\}/gi, sampleLead.last_name);
      result = result.replace(/\{\{email\}\}/gi, sampleLead.email);
      result = result.replace(/\{\{companyName\}\}/gi, sampleLead.company_name);
      result = result.replace(/\{\{companyWebsite\}\}/gi, sampleLead.company_website);
      result = result.replace(/\{\{industry\}\}/gi, sampleLead.industry);
      result = result.replace(/\{\{state\}\}/gi, sampleLead.state);
      result = result.replace(/\{\{market\}\}/gi, sampleLead.market);
      result = result.replace(/\{\{senderFirstName\}\}/gi, sampleSender.first_name);
      result = result.replace(/\{\{senderLastName\}\}/gi, sampleSender.last_name);
      // Add newline before signature and strip any leading HTML from it
      const cleanedSignature = sampleSender.signature.replace(/<br\s*\/?>/g, '\n');
      result = result.replace(/\{\{senderSignature\}\}/gi, '\n' + cleanedSignature);

      return result;
   };

   const handleSend = async () => {
     setSending(true);
     setResult(null);
     try {
       const res = await base44.functions.invoke("sendEmail", {
         gmail_account_id: form.gmail_account_id,
         to: form.to,
         subject: form.subject,
         body: form.body,
         lead_id: form.lead_id || undefined,
       });
       setResult(res.data?.success ? "sent" : "error");
     } catch (err) {
       setResult("error");
       console.error('Send error:', err);
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
          <Label className="text-xs dark:text-neutral-400">Test Lead (Optional - for lead variables)</Label>
          <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select a lead (or leave empty)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>None</SelectItem>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.first_name} {lead.last_name} ({lead.email})
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
            className="h-auto py-2 text-sm font-sans"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs dark:text-neutral-400">Body</Label>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs h-7"
              >
                + Insert Variable
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>

              {showVariables && (
                <div className="absolute z-10 top-full right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-48">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                      onMouseEnter={() => setHoveredVar(v.name)}
                      onMouseLeave={() => setHoveredVar(null)}
                      className={`w-full text-left px-3 py-2 text-xs flex justify-between transition-colors ${
                        hoveredVar === v.name ? "bg-neutral-200 dark:bg-neutral-700" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      }`}
                    >
                      <span className="font-mono text-neutral-600 dark:text-neutral-300">{v.name}</span>
                      <span className="text-neutral-400 dark:text-neutral-500">{v.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <RichTextEditor
            value={form.body}
            onChange={(body) => setForm({ ...form, body })}
            placeholder="Write your email body here..."
          />
          </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="outline"
            className="text-xs h-9"
            onClick={() => setShowPreview(true)}
            disabled={!form.gmail_account_id || !form.subject || isBodyEmpty(form.body)}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Preview
          </Button>
          <Button
            className="bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs h-9"
            onClick={handleSend}
            disabled={sending || !form.gmail_account_id || !form.to || !form.subject || isBodyEmpty(form.body)}
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 space-y-2">
              <div className="text-sm">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">From:</span>
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">{gmailAccountData?.email}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">To:</span>
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">{form.to || '(not set)'}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Subject:</span>
                <span className="ml-2 text-neutral-900 dark:text-neutral-100">{replaceVariables(form.subject)}</span>
              </div>
            </div>
            <div className="p-4 text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
              {stripHTML(replaceVariables(form.body))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      );
      }