import { X, Eye, EyeOff, RefreshCw, Plus, Trash2, Star, Globe, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

import type { VaultEntry, CustomField } from '@/lib/schema';
import { VaultEntrySchema } from '@/lib/schema';
import { useVaultStore } from '@/store/vaultStore';

import { Mail } from 'lucide-react';

type Category = 'Logins' | 'Email' | 'API Keys' | 'Recovery' | 'Notes';

const CATEGORIES: Category[] = ['Logins', 'Email', 'API Keys', 'Recovery', 'Notes'];

const CATEGORY_LABELS: Record<Category, string> = {
  'Logins': '🔑 Login',
  'Email': '✉️ Email',
  'API Keys': '🔧 API Key',
  'Recovery': '🛡️ Recovery',
  'Notes': '📝 Notes',
};

interface EntryModalProps {
  /** null = Add mode, VaultEntry = Edit mode */
  entry?: VaultEntry | null;
  onClose: () => void;
}


export default function EntryModal({ entry, onClose }: EntryModalProps) {
  const isEdit = !!entry;
  const { addEntry, updateEntry, addToast } = useVaultStore();

  const [form, setForm] = useState({
    title: entry?.title ?? '',
    username: entry?.username ?? '',
    password: entry?.password ?? '',
    url: entry?.url ?? '',
    icon: entry?.icon ?? '',
    notes: entry?.notes ?? '',
    category: (entry?.category ?? 'Logins') as Category,
    isFavorite: entry?.isFavorite ?? false,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(entry?.customFields ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingIcon, setIsFetchingIcon] = useState(false);
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const generatePassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    const pwd = Array.from(arr).map((b) => charset[b % charset.length]).join('');
    setForm((f) => ({ ...f, password: pwd }));
    setShowPassword(true);
  };

  const validate = () => {
    const result = VaultEntrySchema.safeParse({
      id: entry?.id ?? crypto.randomUUID(),
      ...form,
      customFields,
      createdAt: entry?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return null;
    }
    setErrors({});
    return result.data;
  };

  const handleUrlChange = (newUrl: string) => {
    setForm(f => ({ ...f, url: newUrl }));
    // Clear previous debounce
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    // Only attempt fetch if url looks complete
    if (!newUrl || newUrl.length < 4) return;
    urlDebounceRef.current = setTimeout(async () => {
      if (form.category === 'Notes' || form.category === 'Recovery') return;
      let testUrl = newUrl;
      if (!testUrl.includes('://')) testUrl = `https://${testUrl}`;
      try { new URL(testUrl); } catch { return; }
      setIsFetchingIcon(true);
      useVaultStore.getState().setNetworkActive(true);
      try {
        const b64 = await invoke<string>('fetch_domain_icon', { url: testUrl });
        if (b64) setForm(f => ({ ...f, icon: b64 }));
      } catch (e) {
        console.warn('Icon fetch failed:', e);
      } finally {
        setIsFetchingIcon(false);
        useVaultStore.getState().setNetworkActive(false);
      }
    }, 900);
  };

  const handleUsernameChange = (newUsername: string) => {
    setForm(f => ({ ...f, username: newUsername }));
    if (form.url) return; // Prefer explicit URL
    if (!newUsername.includes('@')) return;
    
    const domain = newUsername.split('@').pop();
    if (!domain || domain.length < 4 || !domain.includes('.')) return;
    
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(async () => {
      if (form.category === 'Notes' || form.category === 'Recovery') return;
      setIsFetchingIcon(true);
      useVaultStore.getState().setNetworkActive(true);
      try {
        const b64 = await invoke<string>('fetch_domain_icon', { url: `https://${domain}` });
        if (b64) setForm(f => ({ ...f, icon: b64 }));
      } catch (e) {
        console.warn('Icon fetch failed for email domain:', e);
      } finally {
        setIsFetchingIcon(false);
        useVaultStore.getState().setNetworkActive(false);
      }
    }, 900);
  };

  const handleSave = async () => {
    const parsed = validate();
    if (!parsed) return;
    setIsSaving(true);
    try {
      if (isEdit) {
        await updateEntry(parsed);
      } else {
        await addEntry(parsed);
      }
      onClose();
    } catch (e: any) {
      addToast(e.toString(), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomField = () =>
    setCustomFields((f) => [...f, { id: crypto.randomUUID(), label: '', value: '', isSecret: false }]);

  const removeCustomField = (id: string) =>
    setCustomFields((f) => f.filter((cf) => cf.id !== id));

  const updateCustomField = (id: string, patch: Partial<CustomField>) =>
    setCustomFields((f) => f.map((cf) => (cf.id === id ? { ...cf, ...patch } : cf)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-bright rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] anim-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {/* Icon preview or fallback globe */}
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
              {form.icon ? (
                <img src={form.icon} alt="icon" className="w-7 h-7 object-contain" />
              ) : (
                <Globe className="w-4 h-4 text-white/30" />
              )}
            </div>
            <h2 className="text-base font-bold text-white">
              {isEdit ? `Edit "${entry!.title}"` : 'New Entry'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Inline network indicator */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all duration-300",
              isFetchingIcon
                ? "bg-green-500/15 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/15 text-red-400/60"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                isFetchingIcon ? "bg-green-400 animate-pulse" : "bg-red-400/50"
              )} />
              {isFetchingIcon ? <><Wifi className="w-2.5 h-2.5" /> Fetching…</> : 'Offline'}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[70vh] px-6 py-4 flex flex-col gap-4">
          {/* Category tabs */}
          <div id="tour-entry-tabs" className="grid grid-cols-5 gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`tour-tab-${cat.toLowerCase().replace(' ', '-')}`}
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
                className={cn(
                  'py-1.5 text-[10px] font-semibold rounded-lg transition-all',
                  form.category === cat
                    ? cat === 'Email'
                      ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                      : 'bg-violet-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Title */}
          <Field label="Title" error={errors.title} required>
            <input
              id="tour-entry-fields"
              ref={titleRef}
              type="text"
              placeholder={
                form.category === 'Email' ? 'e.g. Personal Gmail' :
                form.category === 'API Keys' ? 'e.g. OpenAI Key' :
                form.category === 'Notes' ? 'e.g. Wi-Fi Password' :
                form.category === 'Recovery' ? 'e.g. Google Backup Codes' :
                'e.g. GitHub'
              }
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass(!!errors.title)}
            />
          </Field>

          {/* Email Address field (for Email category) */}
          {form.category === 'Email' && (
            <Field label="Email Address" error={errors.username} required>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400/60" />
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={form.username ?? ''}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={cn(inputClass(!!errors.username), 'pl-9')}
                  autoComplete="off"
                />
              </div>
            </Field>
          )}

          {/* Username field (for non-Email, non-Notes categories) */}
          {form.category !== 'Notes' && form.category !== 'Email' && (
            <Field label="Username / Email" error={errors.username}>
              <input
                type="text"
                placeholder="user@example.com"
                value={form.username ?? ''}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className={inputClass(false)}
                autoComplete="off"
              />
            </Field>
          )}

          {/* Password */}
          {(form.category === 'Logins' || form.category === 'Email' || form.category === 'API Keys' || form.category === 'Recovery') && (
            <Field label={form.category === 'Recovery' ? 'Recovery Code' : form.category === 'API Keys' ? 'API Key' : 'Password'}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={form.category === 'API Keys' ? 'sk-...' : '••••••••••••'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={cn(inputClass(false), 'pr-20 font-mono')}
                  autoComplete="new-password"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {form.category !== 'Recovery' && form.category !== 'API Keys' && (
                    <button
                      type="button"
                      onClick={generatePassword}
                      title="Generate password"
                      className="p-1.5 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Field>
          )}

          {/* URL */}
          {form.category !== 'Notes' && form.category !== 'Recovery' && form.category !== 'Email' && (
            <Field label="URL" error={errors.url}>
              <div className="relative">
                {form.icon ? (
                  <img src={form.icon} alt="icon" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm object-contain" />
                ) : (
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                )}
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className={cn(inputClass(!!errors.url), "pl-9")}
                />
              </div>
            </Field>
          )}

          {/* Notes */}
          <Field label="Notes">
            <textarea
              placeholder="Additional notes…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className={cn(inputClass(false), 'resize-none')}
            />
          </Field>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold tracking-widest uppercase text-white/30">Custom Fields</p>
              {customFields.map((cf) => (
                <div key={cf.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Label"
                    value={cf.label}
                    onChange={(e) => updateCustomField(cf.id, { label: e.target.value })}
                    className={cn(inputClass(false), 'flex-[0_0_35%]')}
                  />
                  <input
                    type={cf.isSecret ? 'password' : 'text'}
                    placeholder="Value"
                    value={cf.value}
                    onChange={(e) => updateCustomField(cf.id, { value: e.target.value })}
                    className={cn(inputClass(false), 'flex-1')}
                  />
                  <button
                    onClick={() => updateCustomField(cf.id, { isSecret: !cf.isSecret })}
                    title="Toggle secret"
                    className={cn('p-2 rounded-lg border transition-all',
                      cf.isSecret ? 'bg-violet-500/15 border-violet-500/25 text-violet-400' : 'border-white/[0.08] text-white/30 hover:text-white/60'
                    )}
                  >
                    {cf.isSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => removeCustomField(cf.id)}
                    className="p-2 rounded-lg border border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-400/25 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addCustomField}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-violet-400 transition-colors self-start"
          >
            <Plus className="w-3.5 h-3.5" /> Add custom field
          </button>

          {/* Favorite toggle */}
          <button
            onClick={() => setForm((f) => ({ ...f, isFavorite: !f.isFavorite }))}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors self-start',
              form.isFavorite ? 'text-amber-400' : 'text-white/40 hover:text-amber-400'
            )}
          >
            <Star className={cn('w-3.5 h-3.5', form.isFavorite && 'fill-amber-400')} />
            {form.isFavorite ? 'Marked as favorite' : 'Mark as favorite'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 justify-end">
          <button
            id="tour-modal-cancel"
            onClick={onClose}
            className="btn-ghost rounded-xl px-4 py-2 text-sm text-white/60"
          >
            Cancel
          </button>
          <button
            id="tour-entry-save"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, error, required = false, children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-widest uppercase text-white/35">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full bg-white/[0.04] border rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-white/25',
    'focus:bg-white/[0.07] focus:outline-none focus:ring-2 transition-all',
    hasError
      ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/10'
      : 'border-white/[0.08] focus:border-violet-500/50 focus:ring-violet-500/10'
  );
}
