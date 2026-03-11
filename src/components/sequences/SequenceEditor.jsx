import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Eye } from "lucide-react";
import SequenceStepList from "./SequenceStepList.jsx";
import SequenceStepEditor from "./SequenceStepEditor.jsx";

const VARIABLES = [
  { name: "{{firstName}}", label: "First Name" },
  { name: "{{lastName}}", label: "Last Name" },
  { name: "{{email}}", label: "Email" },
  { name: "{{companyName}}", label: "Company Name" },
  { name: "{{companyWebsite}}", label: "Company Website" },
  { name: "{{industry}}", label: "Industry" },
  { name: "{{state}}", label: "State" },
  { name: "{{market}}", label: "Market" },
];

export default function SequenceEditor({ sequence, onBack }) {
  const [localSeq, setLocalSeq] = useState(sequence);
  const [selectedStepId, setSelectedStepId] = useState(sequence.steps?.[0]?.id || null);
  const [showPreview, setShowPreview] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const nameInputRef = useRef(null);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Sequence.update(sequence.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    },
  });

  const selectedStep = localSeq.steps?.find((s) => s.id === selectedStepId);

  const handleUpdateSelectedStep = (updates) => {
    setLocalSeq((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => s.id === selectedStepId ? { ...s, ...updates } : s),
    }));
  };

  const handleAddStep = () => {
    const newStepId = `step-${Date.now()}`;
    const newStep = {
      id: newStepId,
      name: `Step ${localSeq.steps.length + 1}`,
      subject: "<Previous email's subject>",
      body: "",
      delay_days: 3,
      delay_hours: 0,
    };
    setLocalSeq((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
    setSelectedStepId(newStepId);
  };

  const handleUpdateStep = (stepId, updates) => {
    setLocalSeq((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => s.id === stepId ? { ...s, ...updates } : s),
    }));
  };

  const handleDeleteStep = (stepId) => {
    if (localSeq.steps.length === 1) return;
    setLocalSeq((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }));
    setSelectedStepId(localSeq.steps[0]?.id || null);
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: localSeq.name,
      steps: localSeq.steps,
      status: localSeq.status,
    });
  };

  const commitName = () => {
    setEditingName(false);
    if (localSeq.name.trim()) {
      updateMutation.mutate({ name: localSeq.name.trim(), steps: localSeq.steps, status: localSeq.status });
    }
  };

  if (!selectedStep) return null;

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Saved Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Sequence saved
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {editingName ? (
            <input
              ref={nameInputRef}
              autoFocus
              type="text"
              value={localSeq.name}
              onChange={(e) => setLocalSeq({ ...localSeq, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitName(); }
                if (e.key === "Escape") setEditingName(false);
              }}
              onBlur={commitName}
              className="text-lg font-semibold border border-neutral-300 rounded px-2 py-0.5 focus:outline-none focus:border-neutral-500 bg-white"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-neutral-900">{localSeq.name}</span>
              <button
                onClick={() => setEditingName(true)}
                className="text-[11px] text-neutral-400 border border-neutral-300 rounded-full px-2 py-0.5 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="w-4 h-4 mr-1" />
            {showPreview ? "Hide" : "Preview"}
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-neutral-900 hover:bg-neutral-800">
            Save Sequence
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Step List */}
        <SequenceStepList
          steps={localSeq.steps}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onAddStep={handleAddStep}
          onDeleteStep={handleDeleteStep}
          onUpdateStep={handleUpdateStep}
        />

        {/* Right Panel - Editor */}
        <div className="flex-1 overflow-auto bg-white">
          {showPreview ? (
            <SequenceStepEditor
              step={selectedStep}
              onChange={handleUpdateSelectedStep}
              variables={VARIABLES}
              preview
            />
          ) : (
            <SequenceStepEditor
              step={selectedStep}
              onChange={handleUpdateSelectedStep}
              variables={VARIABLES}
            />
          )}
        </div>
      </div>
    </div>
  );
}