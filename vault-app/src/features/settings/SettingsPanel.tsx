import { useEffect, useState, useRef } from 'react';
import { useVaultStore } from '@/store/vaultStore';
import { X, Clock, Clipboard, Shield, Download, Key, EyeOff, Eye, UserRound, Upload as UploadIcon, HelpCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { cn } from '@/lib/utils';
import ImageCropperModal from '@/components/ui/ImageCropperModal';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, saveSetting, addToast, lockVault, fetchStatus, userProfile, updateUserProfile } = useVaultStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'backup'>('profile');
  
  const [profileName, setProfileName] = useState(userProfile?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(userProfile?.avatar || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [autoLock, setAutoLock] = useState(settings.autoLockMinutes);
  const [clipboardClear, setClipboardClear] = useState(settings.clipboardClearSeconds);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSetting('auto_lock_minutes', String(autoLock));
      await saveSetting('clipboard_clear_seconds', String(clipboardClear));
      addToast('Settings saved', 'success');
    } catch (e: unknown) {
      addToast((e as Error).toString(), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateUserProfile({
        name: profileName.trim() || 'CN Vault User',
        avatar: profileAvatar,
      });
      addToast('Profile saved successfully', 'success');
    } catch (e: unknown) {
      addToast((e as Error).toString(), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  const handleChangePassword = async () => {
    if (!currentPassword) return addToast('Current password required', 'error');
    if (newPassword.length < 8) return addToast('New password must be at least 8 characters', 'error');
    if (newPassword !== confirmPassword) return addToast('Passwords do not match', 'error');

    setIsChangingPwd(true);
    try {
      await invoke('change_master_password', { currentPassword, newPassword });
      addToast('Master password successfully changed', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      addToast((e as Error).toString(), 'error');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleExport = async () => {
    try {
      const selected = await save({
        filters: [{ name: 'CN Vault Database', extensions: ['db', 'sqlite'] }],
        defaultPath: 'vault_backup.db',
      });
      if (selected) {
        await invoke('export_vault', { destination: selected });
        addToast('CN Vault exported successfully', 'success');
      }
    } catch (e: unknown) {
      addToast(`Export failed: ${(e as Error).toString()}`, 'error');
    }
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'CN Vault Database', extensions: ['db', 'sqlite'] }],
        multiple: false,
      });
      if (selected) {
        await invoke('import_vault', { sourcePath: selected });
        addToast('CN Vault imported successfully. Please unlock again.', 'success');
        await lockVault();
        await fetchStatus();
        onClose();
      }
    } catch (e: unknown) {
      addToast(`Import failed: ${(e as Error).toString()}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg glass-bright rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] anim-scale-in flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-white">Settings</h2>
          </div>
          <button
            id="tour-settings-close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-white/[0.06]">
          <button
            id="tour-settings-tab-profile"
            onClick={() => setActiveTab('profile')}
            className={cn("pb-3 text-sm font-semibold transition-all border-b-2", activeTab === 'profile' ? "border-violet-500 text-violet-400" : "border-transparent text-white/40 hover:text-white/70")}
          >
            Profile
          </button>
          <button
            id="tour-settings-tab-security"
            onClick={() => setActiveTab('security')}
            className={cn("pb-3 text-sm font-semibold transition-all border-b-2", activeTab === 'security' ? "border-violet-500 text-violet-400" : "border-transparent text-white/40 hover:text-white/70")}
          >
            Security
          </button>
          <button
            id="tour-settings-tab-backup"
            onClick={() => setActiveTab('backup')}
            className={cn("pb-3 text-sm font-semibold transition-all border-b-2", activeTab === 'backup' ? "border-violet-500 text-violet-400" : "border-transparent text-white/40 hover:text-white/70")}
          >
            Backup & Restore
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 flex flex-col gap-8">

          {activeTab === 'profile' && (
            <div className="flex flex-col gap-6">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/30">Your Profile</h3>
              
              <div className="flex flex-col items-center gap-4 mb-2">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-violet-500/50">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserRound className="w-8 h-8 text-white/20" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center">
                    <UploadIcon className="w-5 h-5 text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">Change</span>
                  </div>
                  <div className="absolute bottom-0 right-0 bg-violet-600 rounded-full p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border-2 border-[#120D26] text-white transition-transform group-hover:scale-110">
                    <UploadIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                
                <div className="w-full">
                  <label className="text-xs font-bold tracking-wide text-white/70 ml-1 mb-2 block">Display Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="input-glass w-full rounded-xl py-3 px-4 text-sm"
                    placeholder="Your Name"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 mt-2 transition-all"
              >
                {isSavingProfile ? 'Saving…' : 'Save Profile'}
              </button>

              <div className="h-px w-full bg-white/[0.05] my-2" />

              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/30">Help & Onboarding</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white/80">Interactive App Tour</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Replay the guided walkthrough to learn about the app's features.</div>
                  </div>
                  <button
                    onClick={() => {
                      useVaultStore.getState().startTour();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-xs font-medium border border-white/10"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Start Tour
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <>
              <div className="flex flex-col gap-6">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-white/30">General Security</h3>
                {/* Auto-Lock */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-bold tracking-wide text-white/70">Auto-Lock Timeout</span>
                    <span className="ml-auto text-xs font-mono font-bold text-violet-300">
                      {autoLock} {autoLock === 1 ? 'minute' : 'minutes'}
                    </span>
                  </div>
                  <input
                    type="range" min={1} max={30} step={1}
                    value={autoLock}
                    onChange={(e) => setAutoLock(Number(e.target.value))}
                    className="slider w-full"
                  />
                </div>

                {/* Clipboard Clear */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold tracking-wide text-white/70">Clipboard Auto-Clear</span>
                    <span className="ml-auto text-xs font-mono font-bold text-cyan-300">
                      {clipboardClear}s
                    </span>
                  </div>
                  <input
                    type="range" min={5} max={120} step={5}
                    value={clipboardClear}
                    onChange={(e) => setClipboardClear(Number(e.target.value))}
                    className="slider w-full"
                  />
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {isSaving ? 'Saving…' : 'Save General Settings'}
                </button>
              </div>

              <div className="h-px w-full bg-white/[0.05]" />

              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-red-400/80 flex items-center gap-2">
                  <Key className="w-3 h-3" /> Change Master Password
                </h3>
                
                <div className="flex flex-col gap-3">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-white/25 focus:bg-white/[0.07] focus:outline-none focus:border-violet-500/50"
                  />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-white/25 focus:bg-white/[0.07] focus:outline-none focus:border-violet-500/50"
                  />
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-white/25 focus:bg-white/[0.07] focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white"
                    >
                      {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPwd}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 w-full rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {isChangingPwd ? 'Re-encrypting CN Vault...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'backup' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <UploadIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Export CN Vault</h4>
                    <p className="text-[10px] text-white/40">Save a backup file of your encrypted vault</p>
                  </div>
                </div>
                <button onClick={handleExport} className="btn-primary rounded-xl py-2 text-sm font-semibold mt-2">
                  Export Database
                </button>
              </div>

              <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Import CN Vault</h4>
                    <p className="text-[10px] text-white/40">Restore from a backup database file</p>
                  </div>
                </div>
                <button onClick={handleImport} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-xl py-2 text-sm font-semibold mt-2 transition-all">
                  Import Database
                </button>
                <p className="text-[10px] text-red-400/70 text-center">Warning: This will replace your current data.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCropDone={(croppedStr) => {
            setProfileAvatar(croppedStr);
            setCropSrc(null);
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
