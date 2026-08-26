'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function DeleteAccountSection({
  onConfirm,
  deleting,
}: {
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 lg:p-3">
      <div className="flex items-center gap-3 mb-3 lg:mb-2">
        <div className="w-10 h-10 lg:w-7 lg:h-7 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 lg:w-3.5 lg:h-3.5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-sm lg:text-[11px] font-bold text-rose-300 font-sans uppercase tracking-wider">
            Danger Zone
          </h3>
          <p className="text-xs lg:text-[10px] text-slate-400 font-sans mt-0.5">
            Permanently delete your account and all associated data.
          </p>
        </div>
      </div>
      <div className="p-3 lg:p-2 rounded-xl bg-rose-950/30 border border-rose-500/15 text-xs lg:text-[11px] text-rose-300/80 leading-relaxed mb-4 lg:mb-2">
        <strong className="text-rose-300 block mb-0.5">
          ⚠ This action is irreversible.
        </strong>
        Deleting your account will permanently remove all your chips, stats, cosmetics, friends, match history, and clan memberships. This cannot be undone.
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={deleting}
            className="px-4 py-2.5 lg:px-3 lg:py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-xs lg:text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-slate-900 border-rose-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-400">Delete Account Permanently</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently delete your account, all chips, stats, cosmetics, friends, and match history. This action is irreversible and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Yes, Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
