'use client';

// VA-SETTINGS-MODAL: lobby-header Settings dialog.
// Hosts SettingsSection (moved out of the Agent Profile tabs — user-approved
// placement: welcome page header, next to Rules & Guide).

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection } from '@/components/panels/settings-section';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [toastFn] = useState<(msg: string, type?: 'success' | 'error' | 'info') => void>(
    () => (msg: string, type?: 'success' | 'error' | 'info') => {
      if (type === 'error') toast.error(msg);
      else if (type === 'info') toast.info(msg);
      else toast.success(msg);
    },
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-2xl max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                SETTINGS
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Audio, mobile options, support &amp; legal — saved on this device
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 overflow-y-auto va-scroll max-h-[calc(88vh-130px)]">
          <SettingsSection onToast={toastFn} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsModal;
