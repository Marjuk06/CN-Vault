import { useVaultStore } from '@/store/vaultStore';
import {
  Copy, Eye, EyeOff, ExternalLink, ShieldCheck,
  Star, StarOff, Pencil, Trash2, Clock, ChevronLeft
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import EntryIcon from '@/components/ui/EntryIcon';
import { open } from '@tauri-apps/plugin-shell';

interface EntryDetailProps {
  onEdit: () => void;
  onDelete: () => void;
}

export default function EntryDetail({ onEdit, onDelete }: EntryDetailProps) {
  const { getSelectedEntry, setSelectedEntryId, copyToClipboard, updateEntry, clipboardCountdown } = useVaultStore();
  const entry = getSelectedEntry();
  const [revealPassword, setRevealPassword] = useState(false);

  if (!entry) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 select-none">
        <ShieldCheck className="w-14 h-14 text-white/[0.06] mb-4" />
        <h3 className="text-base font-semibold text-white/20">No entry selected</h3>
        <p className="text-xs text-white/15 mt-1">Select an item from the list</p>
      </div>
    );
  }

  const handleCopy = (value: string) => {
    copyToClipboard(value);
  };

  const toggleFavorite = async () => {
    await updateEntry({ ...entry, isFavorite: !entry.isFavorite, updatedAt: Date.now() });
  };

  const getWebsiteUrl = () => {
    if (entry.url) {
      let u = entry.url;
      if (!u.includes('://')) u = `https://${u}`;
      return u;
    }
    if (entry.category === 'Email' && entry.username && entry.username.includes('@')) {
      const domain = entry.username.split('@').pop();
      if (domain && domain.includes('.')) {
        return `https://${domain}`;
      }
    }
    return null;
  };
  
  const targetUrl = getWebsiteUrl();
  const displayUrl = targetUrl ? targetUrl.replace(/^https?:\/\//, '') : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#060609] absolute md:static inset-0 z-30 md:z-auto">
      {/* Clipboard countdown bar */}
      {clipboardCountdown !== null && (
        <div className="px-8 pt-4">
          <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/[0.06] border border-amber-400/15 rounded-xl px-3 py-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Clipboard clears in {clipboardCountdown}s</span>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-start gap-3 mb-6">
            <button
              onClick={() => setSelectedEntryId(null)}
              className="md:hidden p-2.5 -ml-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors mt-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <EntryIcon
              name={entry.url || entry.title}
              b64Icon={entry.icon}
              size={56}
              className="rounded-2xl"
            />
            <div className="flex-1 min-w-0 ml-1">
              <h2 className="text-2xl font-bold tracking-tight text-white truncate">{entry.title}</h2>
              {targetUrl && displayUrl && (
                <div className="mt-1 flex flex-col items-start gap-2">
                  <span className="text-xs text-white/40 truncate">
                    {displayUrl}
                  </span>
                  <button
                    onClick={() => open(targetUrl)}
                    className="btn-neon mt-1"
                  >
                    <div className="btn-neon-inner">
                      Go to website
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={toggleFavorite}
                title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/40 hover:text-amber-400"
              >
                {entry.isFavorite
                  ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  : <StarOff className="w-4 h-4" />}
              </button>
              <button
                onClick={onEdit}
                title="Edit entry"
                className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/40 hover:text-violet-400"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                title="Delete entry"
                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-white/40 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3">
            {entry.username && (
              <FieldRow
                label="Username"
                value={entry.username}
                onCopy={() => handleCopy(entry.username!)}
              />
            )}

            {entry.password && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.045] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-1.5">Password</div>
                    <div className={cn('text-sm font-mono tracking-widest text-white/85 truncate', !revealPassword && 'blur-[4px] select-none')}>
                      {entry.password}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setRevealPassword((v) => !v)}
                      className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                      title={revealPassword ? 'Hide' : 'Reveal'}
                    >
                      {revealPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopy(entry.password!)}
                      className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25 transition-all"
                      title="Copy password"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {entry.notes && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.045] transition-colors">
                <div className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-2">Secure Notes</div>
                <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}

            {/* Custom fields */}
            {entry.customFields?.map((field, i) => (
              <FieldRow
                key={i}
                label={field.label}
                value={field.isSecret ? '••••••••' : field.value}
                onCopy={() => handleCopy(field.value)}
                isSecret={field.isSecret}
              />
            ))}

            {/* Metadata */}
            <div className="mt-2 flex gap-4 text-[10px] text-white/20">
              <span>Created {new Date(entry.createdAt).toLocaleDateString()}</span>
              <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
              <span className="capitalize">{entry.category}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label, value, onCopy, isSecret = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  isSecret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.045] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold tracking-widest text-white/30 uppercase mb-1">{label}</div>
        <div className={cn('text-sm text-white/80 truncate', isSecret && !revealed && 'blur-[4px] select-none')}>
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isSecret && (
          <button
            onClick={() => setRevealed((v) => !v)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={onCopy}
          className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25 transition-all"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
