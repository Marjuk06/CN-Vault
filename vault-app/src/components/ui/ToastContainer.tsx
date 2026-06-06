import { useVaultStore } from '@/store/vaultStore';
import { CheckCircle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast } from '@/store/vaultStore';

function ToastIcon({ type }: { type: Toast['type'] }) {
  if (type === 'success') return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (type === 'error') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Info className="w-4 h-4 text-violet-400 shrink-0" />;
}

export default function ToastContainer() {
  const { toasts, removeToast } = useVaultStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto anim-fade-up',
            'bg-[#0e0e14] backdrop-blur-xl',
            toast.type === 'success' && 'border-emerald-500/20',
            toast.type === 'error' && 'border-red-500/20',
            toast.type === 'info' && 'border-violet-500/20',
          )}
          style={{ minWidth: 240, maxWidth: 360 }}
        >
          <ToastIcon type={toast.type} />
          <span className="text-sm text-white/80 flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
