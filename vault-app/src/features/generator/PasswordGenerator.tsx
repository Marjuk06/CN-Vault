import { useState, useEffect } from 'react';
import { useVaultStore } from '@/store/vaultStore';
import { X, RefreshCw, Copy, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordGeneratorProps {
  onClose: () => void;
}

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-=',
};

export default function PasswordGenerator({ onClose }: PasswordGeneratorProps) {
  const { copyToClipboard } = useVaultStore();

  const [length, setLength] = useState(16);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });
  const [password, setPassword] = useState('');

  const generatePassword = () => {
    let charset = '';
    if (options.uppercase) charset += CHARSETS.uppercase;
    if (options.lowercase) charset += CHARSETS.lowercase;
    if (options.numbers) charset += CHARSETS.numbers;
    if (options.symbols) charset += CHARSETS.symbols;

    if (charset === '') {
      setPassword('');
      return;
    }

    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += charset[arr[i] % charset.length];
    }
    setPassword(pwd);
  };

  useEffect(() => {
    generatePassword();
  }, [length, options]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopy = () => {
    if (password) {
      copyToClipboard(password);
    }
  };

  // Calculate Entropy
  let poolSize = 0;
  if (options.uppercase) poolSize += 26;
  if (options.lowercase) poolSize += 26;
  if (options.numbers) poolSize += 10;
  if (options.symbols) poolSize += CHARSETS.symbols.length;

  const entropy = password ? Math.round(Math.log2(Math.pow(poolSize, length))) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-bright rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] anim-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white">Password Generator</h2>
          <button
            id="tour-generator-close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Password Output */}
          <div id="tour-generator-output" className="relative bg-black/40 border border-white/10 rounded-xl p-4 overflow-hidden group">
            <div className="text-xl font-mono text-center tracking-wider text-white break-all pr-10">
              {password || 'Select options'}
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg text-white/40 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                title="Copy password"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={generatePassword}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Entropy indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn('w-4 h-4', entropy >= 80 ? 'text-emerald-400' : entropy >= 60 ? 'text-amber-400' : 'text-red-400')} />
              <span className="text-xs font-semibold text-white/70">Entropy</span>
            </div>
            <span className={cn('text-xs font-mono font-bold', entropy >= 80 ? 'text-emerald-400' : entropy >= 60 ? 'text-amber-400' : 'text-red-400')}>
              {entropy} bits
            </span>
          </div>

          {/* Length Slider */}
          <div id="tour-generator-length" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-white/70">Length</span>
              <span className="text-xs font-mono font-bold text-violet-300">{length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={128}
              step={1}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="slider w-full"
            />
          </div>

          {/* Options */}
          <div id="tour-generator-options" className="grid grid-cols-2 gap-3">
            <OptionToggle
              label="A-Z"
              checked={options.uppercase}
              onChange={(c) => setOptions((o) => ({ ...o, uppercase: c }))}
            />
            <OptionToggle
              label="a-z"
              checked={options.lowercase}
              onChange={(c) => setOptions((o) => ({ ...o, lowercase: c }))}
            />
            <OptionToggle
              label="0-9"
              checked={options.numbers}
              onChange={(c) => setOptions((o) => ({ ...o, numbers: c }))}
            />
            <OptionToggle
              label="!@#"
              checked={options.symbols}
              onChange={(c) => setOptions((o) => ({ ...o, symbols: c }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end">
          <button
            onClick={() => { handleCopy(); onClose(); }}
            className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold"
          >
            Copy and Close
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors">
      <span className="text-xs font-mono font-bold text-white/70">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-white/20 bg-black/40 text-violet-500 focus:ring-violet-500/50 focus:ring-offset-0"
      />
    </label>
  );
}
