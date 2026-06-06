import { useVaultStore } from '@/store/vaultStore';
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import EntryIcon from '@/components/ui/EntryIcon';
import { NetworkStatusPill } from './NetworkStatusPill';

interface VaultListProps {
  onAddEntry: () => void;
}



export default function VaultList({ onAddEntry }: VaultListProps) {
  const {
    searchQuery,
    setSearchQuery,
    selectedEntryId,
    setSelectedEntryId,
    getFilteredEntries,
  } = useVaultStore();

  const entries = getFilteredEntries();

  return (
    <div className={cn(
      "w-full md:w-[340px] shrink-0 border-r border-white/[0.05] flex-col h-full bg-white/[0.01]",
      selectedEntryId ? "hidden md:flex" : "flex"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04]">
        {/* Mobile Network Pill */}
        <div className="md:hidden flex justify-center mb-4">
          <NetworkStatusPill />
        </div>
        {/* Search */}
        <div id="tour-search" className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-white/25 focus:bg-white/[0.07] focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 focus:outline-none transition-all"
          />
        </div>

        {/* Count + Add button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/25">
            {entries.length} {entries.length === 1 ? 'item' : 'items'}
          </span>
          <button
            id="tour-add-btn"
            onClick={onAddEntry}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors bg-violet-500/10 hover:bg-violet-500/20 px-2.5 py-1 rounded-lg border border-violet-500/20"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-16 gap-2 text-center px-4">
            <span className="text-3xl opacity-30">🔐</span>
            <p className="text-xs text-white/25 leading-relaxed">
              {searchQuery ? 'No entries match your search.' : 'No entries yet. Click "New" to add one.'}
            </p>
          </div>
        )}

        {entries.map((entry, idx) => {
          const isSelected = entry.id === selectedEntryId;
          const staggerDelay = (idx % 5) * 100;
          return (
            <button
              key={entry.id}
              onClick={() => setSelectedEntryId(entry.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group anim-fade-up',
                isSelected
                  ? 'bg-violet-600/15 border-violet-600/25 shadow-[0_0_20px_rgba(124,58,237,0.08)]'
                  : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] hover:translate-x-0.5'
              )}
              style={{ animationDelay: `${staggerDelay}ms` }}
            >
              <EntryIcon
                name={entry.url || entry.title}
                b64Icon={entry.icon}
                size={32}
                className="rounded-lg"
              />

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-semibold truncate', isSelected ? 'text-white' : 'text-white/80')}>
                  {entry.title}
                </div>
                <div className="text-[10px] text-white/30 truncate mt-0.5">
                  {entry.username || entry.url || entry.category}
                </div>
              </div>

              {/* Favorite dot */}
              {entry.isFavorite && (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
