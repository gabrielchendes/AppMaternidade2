import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  RotateCcw,
  Wand2,
  FileText,
  Layers,
  PlayCircle,
  HelpCircle,
  ArrowRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { showToast } from '../lib/customToast';

interface AiCourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: 'course' | 'module' | 'chapter' | 'element';
  targetTitle?: string;
  currentData: any;
  parentContext?: any;
  onApplyChanges: (modifiedData: any) => Promise<void> | void;
}

const SCOPE_SUGGESTIONS: Record<string, string[]> = {
  course: [
    'Make the entire course tone more authoritative and executive.',
    'Add a comprehensive bonus module covering long-term maintenance.',
    'Enhance the sales page copywriting with 5 additional student objections in the FAQ.'
  ],
  module: [
    'Rewrite this module to be more hands-on and practical.',
    'Add an interactive assessment quiz to test mastery at the end of this module.',
    'Condense this module into clear, actionable bullet-point protocols.'
  ],
  chapter: [
    'Turn this lesson into an interactive decision tree simulator.',
    'Add a message temperature analyzer tool where students paste incoming text.',
    'Add a 30-day streak habit tracker with milestones and an SOS urge pause button.',
    'Include a self-diagnostic coaching journal reflection prompt.'
  ],
  element: [
    'Make this headline punchier and more emotionally compelling.',
    'Rewrite this section using direct-response psychological hooks.',
    'Clarify the core mechanism to be simple and memorable.'
  ]
};

export const AiCourseEditModal: React.FC<AiCourseEditModalProps> = ({
  isOpen,
  onClose,
  scope,
  targetTitle,
  currentData,
  parentContext,
  onApplyChanges
}) => {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [modifiedResult, setModifiedResult] = useState<any>(null);
  const [previousBackup, setPreviousBackup] = useState<any>(null);

  if (!isOpen) return null;

  const suggestions = SCOPE_SUGGESTIONS[scope] || SCOPE_SUGGESTIONS.course;

  const handleRunAiEdit = async () => {
    if (!instruction.trim()) {
      showToast.error('Please enter an instruction for the AI.');
      return;
    }

    setLoading(true);
    setPreviousBackup(JSON.parse(JSON.stringify(currentData)));

    try {
      const res = await fetch('/api/v1/ai-course-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          instruction,
          currentData,
          parentContext
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI edit request failed.');
      }

      const data = await res.json();
      if (!data.modifiedData) {
        throw new Error('No modified data returned from AI.');
      }

      setModifiedResult(data.modifiedData);
      showToast.success('AI modifications generated! Review below.');
    } catch (err: any) {
      console.error('[AI Edit Error]', err);
      showToast.error(err.message || 'Error processing AI edit.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndApply = async () => {
    if (!modifiedResult) return;
    try {
      await onApplyChanges(modifiedResult);
      showToast.success('Changes applied successfully!');
      onClose();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to apply changes.');
    }
  };

  const handleUndo = () => {
    setModifiedResult(null);
    showToast.info('Reverted to original state.');
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f1117] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white font-sans flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase tracking-tight text-white">
                  Edit with AI
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/10 text-primary">
                  Scope: {scope}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {targetTitle ? `Target: "${targetTitle}"` : 'Surgical AI modification'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Instruction Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
              <span>What would you like the AI to change?</span>
              <span className="text-[11px] font-normal text-gray-500">Only requested parts are modified</span>
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              placeholder="Describe your desired changes..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Preset Suggestions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInstruction(sug)}
                  className="text-xs px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition-all text-left cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Result Preview if Generated */}
          {modifiedResult && (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                  <Check size={14} />
                  Proposed AI Modification
                </span>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Undo
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-[#141721] border border-white/5 font-mono text-xs text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(modifiedResult, null, 2)}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase text-gray-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!modifiedResult ? (
              <button
                type="button"
                onClick={handleRunAiEdit}
                disabled={loading || !instruction.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                Generate with AI
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmAndApply}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Check size={14} />
                Apply Changes
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
