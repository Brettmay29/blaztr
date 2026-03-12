import React from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, Link2, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RichTextEditor({ value = "", onChange, placeholder = "", className = "" }) {
  const editorRef = React.useRef(null);

  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = (e) => {
    onChange(e.currentTarget.innerHTML);
  };

  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <div className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-2 flex gap-1 flex-wrap">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("bold");
          }}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("italic");
          }}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("underline");
          }}
          title="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt("Enter URL:");
            if (url) applyFormat("createLink", url);
          }}
          title="Link"
        >
          <Link2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("insertUnorderedList");
          }}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("insertOrderedList");
          }}
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className={cn(
          "p-3 min-h-48 focus:outline-none bg-white dark:bg-neutral-900 text-sm font-sans",
          className
        )}
        style={{ 
          wordWrap: "break-word",
          color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#171717'
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
}