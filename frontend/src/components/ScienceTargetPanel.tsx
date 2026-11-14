import React, { useState } from 'react';
import { ScienceTarget } from '../types';
import { Sparkles, MapPin, Search, ChevronRight, Award } from 'lucide-react';

interface ScienceTargetPanelProps {
  targets: ScienceTarget[];
  selectedTargetId?: string;
  onSelectTarget: (target: ScienceTarget) => void;
}

export const ScienceTargetPanel: React.FC<ScienceTargetPanelProps> = ({
  targets,
  selectedTargetId,
  onSelectTarget
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'high_priority'>('all');

  const filtered = targets.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mineralogy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.geological_unit.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'high_priority') {
      return matchesSearch && t.scientific_relevance >= 9.0;
    }
    return matchesSearch;
  });

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 max-h-[500px]">
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white tracking-wide">Scientific Target Intelligence</h3>
        </div>
        <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded font-mono">
          USGS SIM 3464
        </span>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 bg-mars-dark/60 border border-mars-border px-2.5 py-1.5 rounded-lg text-xs">
          <Search className="w-3.5 h-3.5 text-mars-subtle" />
          <input
            type="text"
            placeholder="Filter by mineral, formation, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-white placeholder-mars-subtle text-xs w-full"
          />
        </div>

        <div className="flex gap-2 text-[11px]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'all'
                ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            All Targets ({targets.length})
          </button>
          <button
            onClick={() => setActiveTab('high_priority')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'high_priority'
                ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            High Biosignature Value (≥9.0)
          </button>
        </div>
      </div>

      {/* Target Cards List */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {filtered.map((target) => {
          const isSelected = target.target_id === selectedTargetId;
          return (
            <div
              key={target.target_id}
              onClick={() => onSelectTarget(target)}
              className={`p-3 rounded-lg border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                isSelected
                  ? 'bg-purple-500/15 border-purple-500 text-white shadow-md'
                  : 'bg-mars-dark/40 border-mars-border/80 text-slate-300 hover:border-mars-subtle hover:bg-mars-dark/70'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] text-purple-400 font-mono font-semibold uppercase flex items-center gap-1">
                    <span>{target.target_id}</span>
                    <span>•</span>
                    <span>{target.unit_symbol}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{target.name}</h4>
                </div>
                <div className="flex items-center gap-1 text-[11px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
                  <Award className="w-3 h-3 text-purple-400" />
                  {target.scientific_relevance.toFixed(1)}
                </div>
              </div>

              <div className="text-[11px] text-mars-subtle">
                <strong className="text-slate-300">Unit:</strong> {target.geological_unit}
              </div>

              <div className="text-[11px] text-mars-subtle truncate">
                <strong className="text-slate-300">Minerals:</strong> {target.mineralogy}
              </div>

              <div className="text-[10px] text-slate-400 bg-mars-panel/60 p-1.5 rounded border border-mars-border/40 mt-0.5 line-clamp-2">
                🎯 {target.investigation_objective}
              </div>

              <div className="flex items-center justify-between text-[10px] text-mars-subtle pt-1 border-t border-mars-border/40 mt-1">
                <span>{target.supporting_instrument}</span>
                <span className="text-purple-300 font-medium flex items-center gap-0.5">
                  Plan Route <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-mars-subtle text-xs">
            No scientific targets match the filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};
