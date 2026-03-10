import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Bold, Italic, Link, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SequenceStepEditor({
  step,
  onChange,
  variables = [],
  preview = false,
}) {
  const [showVariables, setShowVariables] = useState(false);
  const [bodyEditorFocused, setBodyEditorFocused] = useState(false);

  const getTextareaElement = () => document.querySelector("textarea");

  const insertVariable = (varName) => {
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
        newBody = before + "**" + (selectedText || "bold text") + "**" + after;
        newCursorPos = start + 2;
        break;
      case "italic":
        newBody = before + "*" + (selectedText || "italic text") + "*" + after;
        newCursorPos = start + 1;
        break;
      case "bullet":
        newBody = before + "\n• " + (selectedText || "bullet point") + after;
        newCursorPos = start + 3;
        break;
      case "numbered":
        newBody = before + "\n1. " + (selectedText || "numbered item") + after;
        newCursorPos = start + 4;
        break;
      case "link":
        newBody = before + "[link text](https://example.com)" + after;
        newCursorPos = start + 11;
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
                    className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex justify-between"
                  >
                    <span className="font-mono text-neutral-600">{v.name}</span>
                    <span className="text-neutral-400">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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

        {/* Formatting Toolbar */}
        {!preview && (
          <div className="flex items-center gap-1.5 px-4 py-3 border border-t-0 border-neutral-200 rounded-b-lg bg-neutral-50 flex-wrap">
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
          </div>
        )}
      </div>

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