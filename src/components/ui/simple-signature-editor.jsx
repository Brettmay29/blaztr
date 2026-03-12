import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Type } from "lucide-react";

const fontSizes = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
];

const fontFamilies = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];

export default function SimpleSignatureEditor({ value = "", onChange, placeholder = "" }) {
  const editorRef = useRef(null);
  const [fontSize, setFontSize] = React.useState("14px");
  const [fontFamily, setFontFamily] = React.useState("Arial, sans-serif");

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const applyFontSize = (size) => {
    setFontSize(size);
    document.execCommand("fontSize", false, "7");
    const fontElements = editorRef.current?.querySelectorAll("font");
    if (fontElements) {
      fontElements.forEach((el) => {
        el.style.fontSize = size;
        el.style.fontFamily = fontFamily;
        el.parentNode?.replaceChild(el.childNodes[0], el);
      });
    }
  };

  const applyFontFamily = (family) => {
    setFontFamily(family);
    document.execCommand("fontName", false, family);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <select
          value={fontSize}
          onChange={(e) => applyFontSize(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-600"
        >
          {fontSizes.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <select
          value={fontFamily}
          onChange={(e) => applyFontFamily(e.target.value)}
          className="text-xs px-2 py-1 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-600"
        >
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        className={cn(
          "w-full min-h-32 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:border-transparent",
          "text-14 leading-relaxed"
        )}
        style={{ fontFamily }}
      >
        {!value && <span className="text-neutral-400 dark:text-neutral-500">{placeholder}</span>}
      </div>
    </div>
  );
}