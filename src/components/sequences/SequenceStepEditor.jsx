import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eye, X } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { fuzzyReplaceVariables, formatBodyToHtml, DEFAULT_VARIABLE_MAP } from "@/components/emailPreviewUtils";

function EmailPreviewModal({ step, onClose }) {
  const resolvedSubject = fuzzyReplaceVariables(step.subject, DEFAULT_VARIABLE_MAP);
  const previewBodyHtml = formatBodyToHtml(fuzzyReplaceVariables(step.body, DEFAULT_VARIABLE_MAP));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">Email Preview</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="space-y-2 text-sm border-b border-neutral-100 pb-4">
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">From:</span>
              <span className="text-neutral-700">you@youremail.com</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">To:</span>
              <span className="text-neutral-700">John Doe &lt;john@example.com&gt;</span>
            </div>
            <div className="flex gap-2">
              <span className="text-neutral-400 w-16 shrink-0">Subject:</span>
              <span className="text-neutral-800 font-medium">{resolvedSubject || <em className="text-neutral-400">(no subject)</em>}</span>
            </div>
          </div>

          <div
            className="text-sm text-neutral-800 leading-relaxed"
            style={{ fontFamily: 'sans-serif' }}
            dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
          />
        </div>

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
  const [hoveredVar, setHoveredVar] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const quillRef = useRef(null);

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
          <div className="flex items-center gap-1.5 px-4 py-2 border border-t-0 border-neutral-200 dark:border-neutral-700 rounded-b-lg bg-neutral-50 dark:bg-neutral-800">
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
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <EmailPreviewModal step={step} onClose={() => setShowPreview(false)} />
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