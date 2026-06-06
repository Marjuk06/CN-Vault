import { useEffect, useState } from 'react';
import { useVaultStore } from '@/store/vaultStore';
import { invoke } from '@tauri-apps/api/core';
import { ShieldAlert, Loader2 } from 'lucide-react';
import logoUrl from '@/assets/logoo.png';

// Layout
import Layout from '@/components/layout/Layout';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import VaultList from '@/components/layout/VaultList';
import EntryDetail from '@/components/layout/EntryDetail';

// Modals & overlays
import AppTour from '@/components/ui/AppTour';
import EntryModal from '@/features/entries/EntryModal';
import DeleteConfirmDialog from '@/features/entries/DeleteConfirmDialog';
import SettingsPanel from '@/features/settings/SettingsPanel';
import PasswordGenerator from '@/features/generator/PasswordGenerator';
import ToastContainer from '@/components/ui/ToastContainer';
import ErrorBoundary from '@/components/ErrorBoundary';
import SetupWizard from '@/features/auth/SetupWizard';

import { useAutoLock } from '@/hooks/useAutoLock';
import { cn } from '@/lib/utils';

import type { VaultEntry } from '@/lib/schema';

// Modal state

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; entry: VaultEntry }
  | { type: 'delete'; entry: VaultEntry }
  | { type: 'settings' }
  | { type: 'generator' };

// App

function App() {
  const { status, fetchStatus, fetchEntries, fetchSettings, fetchUserProfile, deleteEntry, getSelectedEntry } =
    useVaultStore();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [shake, setShake] = useState(false);

  // Auto Lock Hook
  useAutoLock();

  // Initialisation
  useEffect(() => {
    const init = async () => {
      await fetchStatus();
      setIsLoading(false);
    };
    init();
  }, [fetchStatus]);

  useEffect(() => {
    if (status === 'unlocked') {
      fetchEntries();
      fetchSettings();
      fetchUserProfile();
    }
  }, [status, fetchEntries, fetchSettings, fetchUserProfile]);

  // Auth flow
  const handleAuth = async () => {
    if (!password.trim()) return;
    setError('');
    try {
      if (status === 'uninitialized') {
        await invoke('init_vault', { password });
      } else {
        await invoke('unlock_vault', { password });
      }
      setPassword('');
      await fetchStatus();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message ?? 'Unknown error');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  // Modal helpers
  const openEdit = () => {
    const entry = getSelectedEntry();
    if (entry) setModal({ type: 'edit', entry });
  };

  const openDelete = () => {
    const entry = getSelectedEntry();
    if (entry) setModal({ type: 'delete', entry });
  };

  const handleDeleteConfirm = async () => {
    if (modal.type !== 'delete') return;
    await deleteEntry(modal.entry.id);
    setModal({ type: 'none' });
  };

  // Loading splash
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#060609]">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  // Unlock / Init screen
  if (status === 'uninitialized') {
    return <SetupWizard onComplete={fetchStatus} />;
  }

  if (status === 'locked') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#060609] text-slate-200 font-sans flex items-center justify-center relative">
        {/* Ambient glows */}
        <div className="glow-blob w-[600px] h-[600px] bg-violet-600/15 top-[-150px] left-[-150px]" />
        <div className="glow-blob w-[500px] h-[500px] bg-blue-500/10 bottom-[-100px] right-[-100px]" />

        <div className={cn("glass-bright rounded-3xl p-10 w-full max-w-sm relative z-10 anim-scale-in shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(124,58,237,0.12)]", shake && "anim-shake")}>
          {/* Icon + Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-[#120D26] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-center mb-3 overflow-hidden backdrop-blur-md">
              <img src={logoUrl} alt="CN Vault Logo" className="w-full h-full object-contain scale-[1.0] transition-transform" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white to-violet-300 bg-clip-text text-transparent">
              CN Vault
            </h1>
            <p className="text-[11px] text-white/30 mt-1 tracking-widest uppercase">
              CN Vault Password Manager
            </p>
          </div>

          {/* Password field */}
          <div className="mb-3">
            <input
              type="password"
              placeholder="ENTER MASTER PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
              className="input-glass w-full rounded-xl py-3.5 px-4 text-center tracking-[0.2em] font-medium text-white placeholder:text-white/20 placeholder:tracking-widest placeholder:text-xs placeholder:font-bold transition-all focus:ring-2 focus:ring-violet-500/50"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>
            )}
          </div>

          <button
            onClick={handleAuth}
            className="btn-primary w-full rounded-xl py-3 text-sm font-semibold tracking-wide"
          >
            Unlock Vault
          </button>
        </div>

        <ToastContainer />
      </div>
    );
  }

  // Main application
  return (
    <ErrorBoundary>
      {/* App Tour */}
      <AppTour />

      <Layout>
        <Sidebar
          onOpenSettings={() => setModal({ type: 'settings' })}
          onOpenGenerator={() => setModal({ type: 'generator' })}
        />
        <BottomNav
          onOpenSettings={() => setModal({ type: 'settings' })}
          onAddEntry={() => setModal({ type: 'add' })}
        />
        <VaultList onAddEntry={() => setModal({ type: 'add' })} />
        <EntryDetail onEdit={openEdit} onDelete={openDelete} />
      </Layout>

      {/* Add / Edit modal */}
      {(modal.type === 'add' || modal.type === 'edit') && (
        <EntryModal
          entry={modal.type === 'edit' ? modal.entry : null}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {/* Delete confirmation */}
      {modal.type === 'delete' && (
        <DeleteConfirmDialog
          entryTitle={modal.entry.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}

      {/* Settings panel */}
      {modal.type === 'settings' && (
        <SettingsPanel onClose={() => setModal({ type: 'none' })} />
      )}

      {/* Generator panel */}
      {modal.type === 'generator' && (
        <PasswordGenerator onClose={() => setModal({ type: 'none' })} />
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
