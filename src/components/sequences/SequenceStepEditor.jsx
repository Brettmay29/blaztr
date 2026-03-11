import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Bold, Italic, Link, List, ListOrdered, Code2, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const SAMPLE = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  companyName: "Acme Corp",
  companyWebsite: "acme.com",
  industry: "Technology",
  state: "NY",
  market: "Enterprise",
};

function resolveVariables(text) {
  if (!text) return "";
  return text
    .replace(/\{\{firstName\}\}/g, SAMPLE.firstName)
    .replace(/\{\{lastName\}\}/g, SAMPLE.lastName)
    .replace(/\{\{email\}\}/g, SAMPLE.email)
    .replace(/\{\{companyName\}\}/g, SAMPLE.companyName)
    .replace(/\{\{companyWebsite\}\}/g, SAMPLE.companyWebsite)
    .replace(/\{\{industry\}\}/g, SAMPLE.industry)
    .replace(/\{\{state\}\}/g, SAMPLE.state)
    .replace(/\{\{market\}\}/g, SAMPLE.market);
}

function EmailPreviewModal({ step, onClose }) {
  const resolvedSubject = resolveVariables(step.subject);
  const resolvedBody = resolveVariables(step.body);

  // Strip HTML tags for plain text display, or render as HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(resolvedBody);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">Email Preview</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Email Client-like UI */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Meta */}
          <div className="space-y-2 text-sm border-b border-neutral-100 pb-4">
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">From:</span>
              <span className="text-neutral-700">you@youremail.com</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">To:</span>
              <span className="text-neutral-700">{SAMPLE.firstName} {SAMPLE.lastName} &lt;{SAMPLE.email}&gt;</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">Subject:</span>
              <span className="text-neutral-800 font-medium">{resolvedSubject || <em className="text-neutral-400">(no subject)</em>}</span>
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-neutral-800 leading-relaxed">
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: resolvedBody }} />
            ) : (
              <div className="whitespace-pre-wrap">{resolvedBody}</div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-400">
          Variables replaced with sample data for preview.
        </div>
      </div>
    </div>
  );
}

export default function SequenceStepEditor({
  step,
  onChange,
  variables = [],
  preview = false,
}) {
  const [showVariables, setShowVariables] = useState(false);
  const [bodyEditorFocused, setBodyEditorFocused] = useState(false);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [hoveredVar, setHoveredVar] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const quillRef = useRef(null);

  const getTextareaElement = () => document.querySelector("textarea");

  const insertVariable = (varName) => {
    if (isMarkdownMode) {
      const textarea = getTextareaElement();
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = step.body.substring(0, start);
      const after = step.body.substring(end);
      const newBody = before + varName + after;

      onChange({ body: newBody });
      setShowVariables(false);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + varName.length;
        textarea.focus();
      }, 0);
    } else {
      // Insert into Quill editor
      if (quillRef.current?.getEditor) {
        const editor = quillRef.current.getEditor();
        const currentLength = editor.getLength();
        editor.insertText(currentLength - 1, varName + " ");
        editor.setSelection(currentLength - 1 + varName.length + 1);
        setShowVariables(false);
      }
    }
  };

  const applyFormatting = (format) => {
    const textarea = getTextareaElement();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = step.body.substring(start, end);
    const before = step.body.substring(0, start);
    const after = step.body.substring(end);

    let newBody = "";
    let newCursorPos = start;

    switch (format) {
      case "bold":
        if (selectedText) {
          newBody = before + "**" + selectedText + "**" + after;
          newCursorPos = end + 4;
        } else {
          newBody = before + "****" + after;
          newCursorPos = start + 2;
        }
        break;
      case "italic":
        if (selectedText) {
          newBody = before + "*" + selectedText + "*" + after;
          newCursorPos = end + 2;
        } else {
          newBody = before + "**" + after;
          newCursorPos = start + 1;
        }
        break;
      case "bullet":
        newBody = before + "\n• " + selectedText + after;
        newCursorPos = start + 3 + selectedText.length;
        break;
      case "numbered":
        newBody = before + "\n1. " + selectedText + after;
        newCursorPos = start + 4 + selectedText.length;
        break;
      case "link":
        if (selectedText) {
          newBody = before + "[" + selectedText + "](https://example.com)" + after;
          newCursorPos = end + 19;
        } else {
          newBody = before + "[link](https://example.com)" + after;
          newCursorPos = start + 6;
        }
        break;
      case "signature":
        const sig = "\n\n---\n[Your Name]\n[Your Title]\n[Company]";
        newBody = step.body + sig;
        newCursorPos = step.body.length;
        break;
      default:
        return;
    }

    onChange({ body: newBody });

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Subject */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700">Subject</label>
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
        <label className="text-sm font-medium text-neutral-700">Send timing</label>
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
          <label className="text-sm font-medium text-neutral-700">Email Body</label>
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

        {isMarkdownMode ? (
          <textarea
            value={step.body}
            onChange={(e) => onChange({ body: e.target.value })}
            onFocus={() => setBodyEditorFocused(true)}
            onBlur={() => setBodyEditorFocused(false)}
            placeholder="Write your email body. Use variables like {{firstName}} for dynamic content."
            className="w-full h-72 p-4 border border-t-0 border-neutral-200 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            style={{ fontSize: "10pt", fontFamily: "system-ui, -apple-system, sans-serif" }}
            disabled={preview}
          />
        ) : (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
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
        )}

        {/* Editor Mode Toggle */}
        {!preview && (
          <div className="flex items-center gap-1.5 px-4 py-2 border border-t-0 border-neutral-200 rounded-b-lg bg-neutral-50">

            <Button
              size="sm"
              variant={isMarkdownMode ? "default" : "outline"}
              className="h-8 text-xs"
              title="Toggle Markdown Mode"
              onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            >
              <Code2 className="w-3.5 h-3.5 mr-1" />
              {isMarkdownMode ? "Markdown" : "Rich Text"}
            </Button>
            
            <div className="ml-auto">
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

            {isMarkdownMode && (
              <>
                <div className="h-5 w-px bg-neutral-300" />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 p-0 hover:bg-neutral-200"
                  title="Bold"
                  onClick={() => applyFormatting("bold")}
                >
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 p-0 hover:bg-neutral-200"
                  title="Italic"
                  onClick={() => applyFormatting("italic")}
                >
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                <div className="h-5 w-px bg-neutral-300" />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 p-0 hover:bg-neutral-200"
                  title="Bullet List"
                  onClick={() => applyFormatting("bullet")}
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 p-0 hover:bg-neutral-200"
                  title="Numbered List"
                  onClick={() => applyFormatting("numbered")}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </Button>
                <div className="h-5 w-px bg-neutral-300" />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 p-0 hover:bg-neutral-200"
                  title="Link"
                  onClick={() => applyFormatting("link")}
                >
                  <Link className="w-3.5 h-3.5" />
                </Button>
                <div className="h-5 w-px bg-neutral-300" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs hover:bg-neutral-200"
                  title="Add Signature"
                  onClick={() => applyFormatting("signature")}
                >
                  + Signature
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <EmailPreviewModal step={step} onClose={() => setShowPreview(false)} />
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-neutral-50 p-4 rounded-lg space-y-2 border border-neutral-200">
          <h4 className="text-sm font-medium text-neutral-700">Preview (with sample data)</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-neutral-700">Subject: </span>
              <span className="text-neutral-600">{step.subject}</span>
            </div>
            <div className="bg-white p-3 rounded border border-neutral-200 whitespace-pre-wrap text-neutral-700 font-mono text-xs">
              {step.body
                .replace(/{{firstName}}/g, "John")
                .replace(/{{lastName}}/g, "Doe")
                .replace(/{{email}}/g, "john@example.com")
                .replace(/{{companyName}}/g, "Acme Corp")
                .replace(/{{companyWebsite}}/g, "acme.com")
                .replace(/{{industry}}/g, "Technology")
                .replace(/{{state}}/g, "NY")
                .replace(/{{market}}/g, "Enterprise")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}