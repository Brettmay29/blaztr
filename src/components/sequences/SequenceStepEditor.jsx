import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, Eye, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { fuzzyReplaceVariables, formatBodyToHtml, DEFAULT_VARIABLE_MAP } from "@/components/emailPreviewUtils";

function EmailPreviewModal({ step, leadData, gmailAccountData, onClose }) {
  const variableMap = {
    ...DEFAULT_VARIABLE_MAP,
    ...(leadData ? {
      firstname: leadData.first_name || DEFAULT_VARIABLE_MAP.firstname,
      lastname: leadData.last_name || DEFAULT_VARIABLE_MAP.lastname,
      email: leadData.email || DEFAULT_VARIABLE_MAP.email,
      companyname: leadData.company_name || DEFAULT_VARIABLE_MAP.companyname,
      companywebsite: leadData.company_website || DEFAULT_VARIABLE_MAP.companywebsite,
      industry: leadData.industry || DEFAULT_VARIABLE_MAP.industry,
      state: leadData.state || DEFAULT_VARIABLE_MAP.state,
      market: leadData.market || DEFAULT_VARIABLE_MAP.market,
    } : {}),
    senderfirstname: gmailAccountData?.first_name || DEFAULT_VARIABLE_MAP.senderfirstname,
    senderlastname: gmailAccountData?.last_name || DEFAULT_VARIABLE_MAP.senderlastname,
    sendersignature: gmailAccountData?.signature || DEFAULT_VARIABLE_MAP.sendersignature,
  };

  // Replace variables in the raw Quill HTML (preserves <p> tags / spacing)
  const replaceVarsInHtml = (html) => {
    if (!html) return '';
    return html.replace(/\{\{([^}]+)\}\}/gi, (match, varName) => {
      const key = varName.toLowerCase().replace(/\s+/g, '').trim();
      return variableMap[key] !== undefined ? variableMap[key] : match;
    });
  };

  const resolvedSubject = fuzzyReplaceVariables(step.subject, variableMap);
  const resolvedBodyHtml = replaceVarsInHtml(step.body);

  const toDisplay = leadData
    ? `${leadData.first_name || ''} ${leadData.last_name || ''} <${leadData.email}>`.trim()
    : 'John Doe <john@example.com>';

  const fromDisplay = gmailAccountData
    ? `${gmailAccountData.first_name || ''} ${gmailAccountData.last_name || ''} <${gmailAccountData.email}>`.trim()
    : 'you@youremail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Email Preview</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="space-y-2 text-sm border-b border-neutral-100 dark:border-neutral-700 pb-4">
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">From:</span>
              <span className="text-neutral-700 dark:text-neutral-300">{fromDisplay}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">To:</span>
              <span className="text-neutral-700 dark:text-neutral-300">{toDisplay}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">Subject:</span>
              <span className="text-neutral-800 dark:text-neutral-100 font-medium">{resolvedSubject || <em className="text-neutral-400">(no subject)</em>}</span>
            </div>
          </div>

          <div
            className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed ql-editor"
            style={{ fontFamily: 'sans-serif', padding: 0 }}
            dangerouslySetInnerHTML={{ __html: resolvedBodyHtml }}
          />
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-400">
          {leadData ? `Showing variables for: ${leadData.first_name} ${leadData.last_name}` : 'Variables replaced with sample data for preview.'}
        </div>
      </div>
    </div>
  );
}

function SendTestModal({ step, leadData, selectedLeadId, onClose }) {
  const [toEmail, setToEmail] = useState('');
  const [gmailAccountId, setGmailAccountId] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const { data: gmailAccounts = [] } = useQuery({
    queryKey: ["gmail_accounts"],
    queryFn: () => base44.entities.GmailAccount.list(),
  });

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("sendEmail", {
        gmail_account_id: gmailAccountId,
        to: toEmail,
        subject: step.subject,
        body: step.body,
        lead_id: selectedLeadId || undefined,
      });
      setResult(res.data?.success ? "sent" : "error");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">From (Gmail Account)</Label>
            <Select value={gmailAccountId} onValueChange={setGmailAccountId}>
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
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <Button
            className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs h-9"
            onClick={handleSend}
            disabled={sending || !gmailAccountId || !toEmail}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Send Test
          </Button>
          {result === "sent" && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Test email sent successfully!
            </div>
          )}
          {result === "error" && (
            <p className="text-xs text-red-500">Failed to send. Check your Gmail connection.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SequenceStepEditor({
  step,
  onChange,
  variables = [],
  preview = false,
}) {
  const [showVariables, setShowVariables] = useState(false);
  const [hoveredVar, setHoveredVar] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSendTest, setShowSendTest] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const quillRef = useRef(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads_for_seq_test"],
    queryFn: () => base44.entities.Lead.list(),
  });

  const { data: leadData } = useQuery({
    queryKey: ["lead_for_seq_test", selectedLeadId],
    queryFn: () => selectedLeadId ? base44.entities.Lead.get(selectedLeadId) : null,
    enabled: !!selectedLeadId,
  });

  const insertVariable = (varName) => {
    if (quillRef.current?.getEditor) {
      const editor = quillRef.current.getEditor();
      const currentLength = editor.getLength();
      editor.insertText(currentLength - 1, varName + " ");
      editor.setSelection(currentLength - 1 + varName.length + 1);
      setShowVariables(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl dark:text-neutral-100">
      {/* Subject */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Subject</label>
        <Input
          value={step.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Email subject line"
          className="text-sm"
          disabled={preview}
        />
      </div>

      {/* Delay */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Send timing</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-neutral-500">Days</label>
            <Input
              type="number"
              min="0"
              max="365"
              value={step.delay_days}
              onChange={(e) => onChange({ delay_days: parseInt(e.target.value) || 0 })}
              className="text-sm"
              disabled={preview}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-neutral-500">Hours</label>
            <Input
              type="number"
              min="0"
              max="23"
              value={step.delay_hours}
              onChange={(e) => onChange({ delay_hours: parseInt(e.target.value) || 0 })}
              className="text-sm"
              disabled={preview}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Email Body</label>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowVariables(!showVariables)}
              disabled={preview}
              className="text-xs"
            >
              + Insert Variable
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>

            {showVariables && (
              <div className="absolute z-10 top-full right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-48">
                {variables.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => insertVariable(v.name)}
                    onMouseEnter={() => setHoveredVar(v.name)}
                    onMouseLeave={() => setHoveredVar(null)}
                    className={`w-full text-left px-3 py-2 text-xs flex justify-between transition-colors ${
                      hoveredVar === v.name ? "bg-neutral-200" : "hover:bg-neutral-100"
                    }`}
                  >
                    <span className="font-mono text-neutral-600">{v.name}</span>
                    <span className="text-neutral-400">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
          <ReactQuill
            ref={quillRef}
            value={step.body}
            onChange={(value) => onChange({ body: value })}
            theme="snow"
            placeholder="Write your email body. Use variables like {{firstName}} for dynamic content."
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
            readOnly={preview}
            style={{ height: "320px" }}
          />
        </div>

        {/* Preview Button */}
        {!preview && (
          <div className="flex items-center gap-2 px-4 py-2 border border-t-0 border-neutral-200 dark:border-neutral-700 rounded-b-lg bg-neutral-50 dark:bg-neutral-800">
            <div className="flex-1 min-w-0">
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="h-8 text-xs max-w-xs">
                  <SelectValue placeholder="Test Lead (optional)" />
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
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShowSendTest(true)}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Send Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                Preview
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <EmailPreviewModal step={step} leadData={leadData} onClose={() => setShowPreview(false)} />
      )}
      {showSendTest && (
        <SendTestModal step={step} leadData={leadData} selectedLeadId={selectedLeadId} onClose={() => setShowSendTest(false)} />
      )}

      {/* Inline Preview (read-only mode) */}
      {preview && (
        <div className="bg-neutral-50 p-4 rounded-lg space-y-2 border border-neutral-200">
          <h4 className="text-sm font-medium text-neutral-700">Preview (with sample data)</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-neutral-700">Subject: </span>
              <span className="text-neutral-600">{fuzzyReplaceVariables(step.subject, DEFAULT_VARIABLE_MAP)}</span>
            </div>
            <div
              className="bg-white p-3 rounded border border-neutral-200 text-neutral-700 text-xs leading-relaxed"
              style={{ fontFamily: 'sans-serif' }}
              dangerouslySetInnerHTML={{ __html: formatBodyToHtml(fuzzyReplaceVariables(step.body, DEFAULT_VARIABLE_MAP)) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}