import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SequenceStepList({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onUpdateStep,
}) {
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const startEdit = (e, step) => {
    e.stopPropagation();
    setEditingStepId(step.id);
    setEditingName(step.name || `Step ${steps.indexOf(step) + 1}`);
  };

  const saveEdit = (stepId) => {
    if (editingName.trim()) {
      onUpdateStep(stepId, { name: editingName.trim() });
    }
    setEditingStepId(null);
  };

  return (
    <div className="w-56 bg-neutral-50 border-r border-neutral-200 flex flex-col">
      {/* Steps */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id}>
            {editingStepId === step.id ? (
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => saveEdit(step.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(step.id);
                  if (e.key === "Escape") setEditingStepId(null);
                }}
                className="h-8 text-sm font-medium"
              />
            ) : (
              <button
                onDoubleClick={(e) => startEdit(e, step)}
                onClick={() => onSelectStep(step.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  selectedStepId === step.id
                    ? "bg-white text-neutral-900 border border-neutral-200"
                    : "text-neutral-700 hover:bg-white/60"
                )}
                title="Double-click to rename"
              >
                {step.name || `Step ${idx + 1}`}
              </button>
            )}

            {step.delay_days > 0 || step.delay_hours > 0 ? (
              <p className="text-xs text-neutral-500 mt-1 ml-3">
                Send in {step.delay_days > 0 ? `${step.delay_days}d` : ""} {step.delay_hours > 0 ? `${step.delay_hours}h` : ""}
              </p>
            ) : (
              <p className="text-xs text-neutral-500 mt-1 ml-3">Immediate</p>
            )}

            {selectedStepId === step.id && editingStepId !== step.id && (
              <div className="flex items-center gap-1.5 mt-2 ml-3">
                {steps.length > 1 && (
                  <button
                    onClick={() => onDeleteStep(step.id)}
                    className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                    title="Delete step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Step Button */}
      <div className="p-4 border-t border-neutral-200">
        <Button
          onClick={onAddStep}
          variant="outline"
          size="sm"
          className="w-full text-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Step
        </Button>
      </div>
    </div>
  );
}