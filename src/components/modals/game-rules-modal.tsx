'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookOpen } from 'lucide-react';
import { Section00_Accounts } from './rules/Section00_Accounts';
import { Section01_Controls } from './rules/Section01_Controls';
import { Section02_Modes } from './rules/Section02_Modes';
import { Section03_Food } from './rules/Section03_Food';
import { Section04_Boost } from './rules/Section04_Boost';
import { Section05_Collision } from './rules/Section05_Collision';
import { Section06_BotAI } from './rules/Section06_BotAI';
import { Section07_Map } from './rules/Section07_Map';
import { Section08_Extraction } from './rules/Section08_Extraction';
import { Section09_HUD } from './rules/Section09_HUD';
import { Section10_Challenges } from './rules/Section10_Challenges';
import { Section11_Death } from './rules/Section11_Death';
import { Section12_Leaderboards } from './rules/Section12_Leaderboards';
import { Section13_Championships } from './rules/Section13_Championships';
import { Section14_HOF } from './rules/Section14_HOF';
import { Section15_Syndicates } from './rules/Section15_Syndicates';
import { Section16_Profile } from './rules/Section16_Profile';
import { Section17_ShopLab } from './rules/Section17_ShopLab';
import { Section18_Social } from './rules/Section18_Social';
import { Section19_CyberPass } from './rules/Section19_CyberPass';
import { Section20_Highlights } from './rules/Section20_Highlights';
import { Section21_FAQ } from './rules/Section21_FAQ';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 max-w-3xl max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                VENOM ARENA — OFFICIAL GUIDE &amp; RULES
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Accounts, controls, modes, arena tiers, HUD, extraction, challenges, death, leaderboards, championships, hall of fame, syndicates, profile, shop &amp; lab, social, cyber pass, highlights &amp; FAQ
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto va-scroll max-h-[calc(88vh-130px)]">
          {/* HERO */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950/50 border border-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest block uppercase">
              What is Venom Arena
            </span>
            <h3 className="text-lg font-black text-white mt-1">
              Buy in. Collect. Extract. Become Champion.
            </h3>
            <p className="text-xs text-slate-300 font-sans mt-2 leading-relaxed">
              Venom Arena is a mobile-first global multiplayer championship snake game. Buy into an arena with chips,
              collect chips from defeated snakes, and extract before someone makes you their harvest — only banked chips
              count. The player with the highest banked chips at season&apos;s end wins the Global Championship: virtual
              chip prizes and permanent recognition in the Hall of Fame. Climb the live country and region leaderboards,
              squad up in syndicates, and post your best runs to Highlights.
            </p>
          </div>

          <Section00_Accounts />
          <Section01_Controls />
          <Section02_Modes />
          <Section03_Food />
          <Section04_Boost />
          <Section05_Collision />
          <Section06_BotAI />
          <Section07_Map />
          <Section08_Extraction />
          <Section09_HUD />
          <Section10_Challenges />
          <Section11_Death />
          <Section12_Leaderboards />
          <Section13_Championships />
          <Section14_HOF />
          <Section15_Syndicates />
          <Section16_Profile />
          <Section17_ShopLab />
          <Section18_Social />
          <Section19_CyberPass />
          <Section20_Highlights />
          <Section21_FAQ />

          {/* FOOTER */}
          <div className="text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-2 border-t border-slate-800/60">
            Play responsibly · Chips have no real-world value · Stores-safe edition
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30"
          >
            Understood &amp; Ready to Play
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GameRulesModal;
