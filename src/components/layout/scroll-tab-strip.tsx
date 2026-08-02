'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TabItem = {
  id: string;
  label: string;
  icon: typeof ChevronLeft;
  activeColor: string;
};

interface ScrollTabStripProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function ScrollTabStrip({ tabs, activeTab, onTabChange }: ScrollTabStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    const el = scrollRef.current;
    if (!el) return () => clearTimeout(timer);
    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [checkScroll, tabs]);

  // Auto-scroll active tab into view when it changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement | null;
    if (!activeBtn) return;
    const containerRect = el.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (btnRect.left < containerRect.left || btnRect.right > containerRect.right) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative flex-1 min-w-0">
      {/* Left fade overlay */}
      {canScrollLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none rounded-l-xl" style={{ background: 'linear-gradient(to right, rgba(15,23,42,0.92), rgba(15,23,42,0.4), transparent)' }}
          aria-hidden="true"
        />
      )}

      {/* Right fade overlay */}
      {canScrollRight && (
        <div
          className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none rounded-r-xl" style={{ background: 'linear-gradient(to left, rgba(15,23,42,0.92), rgba(15,23,42,0.4), transparent)' }}
          aria-hidden="true"
        />
      )}

      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy('left')}
          className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-600/80 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all cursor-pointer shadow-lg shadow-black/50"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy('right')}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-600/80 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all cursor-pointer shadow-lg shadow-black/50"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-transparent shrink-0 ${
                isActive ? `${tab.activeColor} border` : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
