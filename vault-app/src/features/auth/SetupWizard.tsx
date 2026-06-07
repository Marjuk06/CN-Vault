import { useState, useRef } from 'react';
import { KeyRound, ArrowRight, UserRound, Upload as UploadIcon, Settings as SettingsIcon, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useVaultStore } from '@/store/vaultStore';
import ImageCropperModal from '@/components/ui/ImageCropperModal';
import logoUrl from '@/assets/logoo.png';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { updateUserProfile, fetchStatus, saveSetting } = useVaultStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [autoLock, setAutoLock] = useState(5);
  const [clipboardClear, setClipboardClear] = useState(30);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(reader.result?.toString() || null);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const nextStepProfile = () => {
    if (!name.trim()) {
      setError('Please enter a display name');
      return;
    }
    setError('');
    setStep(2);
  };

  const nextStepSecurity = () => {
    setStep(3);
  };

  const handleFinish = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setError('');
    setIsLoading(true);
    try {
      await invoke('init_vault', { password });
      
      await updateUserProfile({
        name: name.trim() || 'CN Vault User',
        avatar,
      });

      await saveSetting('auto_lock_minutes', String(autoLock));
      await saveSetting('clipboard_clear_seconds', String(clipboardClear));
      
      await fetchStatus();
      onComplete();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="glass-bright rounded-3xl p-8 w-full max-w-sm relative z-10 anim-scale-in shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(124,58,237,0.12)]">
        
        {/* Step 1: Profile Setup */}
        {step === 1 && (
          <div className="flex flex-col items-center anim-fade-in">
            <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center mb-4 overflow-hidden">
              <img src={logoUrl} alt="CN Vault Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-violet-300 bg-clip-text text-transparent">
              Welcome to CN Vault
            </h1>
            <p className="text-[11px] text-white/30 mt-1 mb-6 tracking-widest uppercase text-center">
              Create your profile
            </p>
            
            <div className="w-full flex flex-col items-center gap-4 mb-4">
              {/* Avatar Selector */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-violet-500/50">
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserRound className="w-8 h-8 text-white/20" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center">
                    <UploadIcon className="w-5 h-5 text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">Upload</span>
                  </div>
                  <div className="absolute bottom-0 right-0 bg-violet-600 rounded-full p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border-2 border-[#120D26] text-white transition-transform group-hover:scale-110">
                    <UploadIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Profile Picture (Optional)</span>
              </div>
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
              
              {/* Name Input */}
              <div className="w-full delay-100 anim-fade-up">
                <input
                  type="text"
                  placeholder="Your Display Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') nextStepProfile(); }}
                  className="input-glass w-full rounded-xl py-3 px-4 text-sm text-center"
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs mb-3 text-center w-full">{error}</p>}
            
            <button
              onClick={nextStepProfile}
              className="w-full btn-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 mt-2 delay-200 anim-fade-up"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: General Security */}
        {step === 2 && (
          <div className="flex flex-col items-center anim-slide-up">
            <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.5)] mb-4">
              <SettingsIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-violet-300 bg-clip-text text-transparent text-center leading-tight">
              General Security
            </h1>
            <p className="text-[11px] text-white/30 mt-2 mb-6 text-center leading-relaxed max-w-[250px]">
              Configure your daily security habits. You can change these later in settings.
            </p>
            
            <div className="w-full flex flex-col gap-5 mb-6 text-left">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold tracking-wider text-white/60">Auto-Lock Timeout</label>
                  <span className="text-[11px] text-white/80 bg-white/5 px-2 py-0.5 rounded font-mono">{autoLock} {autoLock === 1 ? 'min' : 'mins'}</span>
                </div>
                <input
                  type="range"
                  min="1" max="30"
                  value={autoLock}
                  onChange={(e) => setAutoLock(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  How long the vault stays unlocked when you step away.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold tracking-wider text-white/60">Clipboard Auto-Clear</label>
                  <span className="text-[11px] text-white/80 bg-white/5 px-2 py-0.5 rounded font-mono">{clipboardClear}s</span>
                </div>
                <input
                  type="range"
                  min="10" max="120" step="10"
                  value={clipboardClear}
                  onChange={(e) => setClipboardClear(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  Clears your copied passwords from the system clipboard so other apps can't snoop.
                </p>
              </div>
            </div>

            <button
              onClick={nextStepSecurity}
              className="w-full btn-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 mt-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 3: Master Password */}
        {step === 3 && (
          <div className="flex flex-col items-center anim-slide-up">
            <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.5)] mb-4">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-violet-300 bg-clip-text text-transparent text-center leading-tight">
              Master Password
            </h1>
            <p className="text-[11px] text-white/30 mt-2 mb-6 text-center leading-relaxed max-w-[250px]">
              This password encrypts everything. If lost, your data cannot be recovered.
            </p>
            
            <div className="w-full flex flex-col gap-3 mb-2">
              <input
                type="password"
                placeholder="Create master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-glass w-full rounded-xl py-3 px-4 text-sm"
                autoFocus
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFinish(); }}
                className="input-glass w-full rounded-xl py-3 px-4 text-sm"
              />
            </div>

            {error && <p className="text-red-400 text-xs mt-2 mb-2 w-full text-left ml-2">{error}</p>}
            
            <div className="flex w-full gap-2 mt-4">
              <button
                onClick={() => setStep(1)}
                className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                disabled={isLoading}
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={isLoading}
                className="flex-1 btn-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Creating CN Vault...' : 'Complete Setup'}
                {!isLoading && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCropDone={(croppedStr) => {
            setAvatar(croppedStr);
            setCropSrc(null);
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}
