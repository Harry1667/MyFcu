'use client';

import { useState, useTransition } from 'react';
import { clearLogs } from '@/lib/actions/logs';

type Item = {
  id: string;
  displayName: string;
  fcuNid: string;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  verified: boolean | null;
  verifyMessage: string | null;
};

type Session = {
  key: string;
  createdAt: Date;
  token: string;
  items: Item[];
};

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

function itemBadge(item: Item) {
  if (item.status === 'failed') return { color: 'var(--danger)', label: '送出失敗' };
  if (item.verified === true) return { color: 'var(--tint)', label: '✓ 已記錄' };
  if (item.verified === false) return { color: 'var(--amber)', label: '⚠️ 未確認' };
  return { color: 'var(--label-2)', label: '已送出' };
}

export function LogsClient({
  sessions,
  totalCount,
}: {
  sessions: Session[];
  totalCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  const handleClear = () => {
    if (!confirm(`刪除全部 ${totalCount} 筆紀錄？`)) return;
    startTransition(async () => {
      await clearLogs();
    });
  };

  return (
    <>
      <div className="mt-4 mb-2 flex items-center justify-between px-1 text-[13px] text-[--label-2]">
        <span>
          共 {sessions.length} 次掃描、{totalCount} 筆
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={pending}
          className="font-medium text-[--danger]"
        >
          清空
        </button>
      </div>

      <ul className="space-y-3">
        {sessions.map((s) => {
          const verified = s.items.filter((i) => i.verified === true).length;
          const unverified = s.items.filter((i) => i.status === 'sent' && i.verified === false).length;
          const failed = s.items.filter((i) => i.status === 'failed').length;
          const isOpen = expanded.has(s.key);
          return (
            <li key={s.key} className="ios-card">
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-[--fill]"
              >
                <div>
                  <div className="text-[15px] font-medium text-[--label]">
                    {s.createdAt.toLocaleString('zh-TW', { hour12: false })}
                  </div>
                  <div className="text-[12px] text-[--label-2]">
                    {timeAgo(s.createdAt)} · {s.items.length} 個帳號
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {verified > 0 && <Pill color="var(--tint)">✓ {verified}</Pill>}
                  {unverified > 0 && <Pill color="var(--amber)">⚠️ {unverified}</Pill>}
                  {failed > 0 && <Pill color="var(--danger)">✗ {failed}</Pill>}
                  <span className={`text-[--label-3] transition ${isOpen ? 'rotate-90' : ''}`}>
                    <svg width="8" height="13" viewBox="0 0 9 15" fill="none">
                      <path
                        d="M1.5 1.5L7 7.5l-5.5 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="space-y-2 px-3 pb-3">
                  <div className="rounded-lg bg-[--fill] px-3 py-2">
                    <div className="text-[11px] text-[--label-2]">QR token</div>
                    <div className="mt-1 break-all font-mono text-[11px] text-[--label]">
                      {s.token}
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {s.items.map((it) => {
                      const b = itemBadge(it);
                      const detail = it.verifyMessage ?? it.errorMessage;
                      return (
                        <li key={it.id} className="rounded-lg bg-[--fill] px-2.5 py-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: avatarColor(it.fcuNid) }}
                            >
                              {it.displayName.slice(0, 1)}
                            </span>
                            <div className="flex-1">
                              <div className="text-[14px] font-medium text-[--label]">
                                {it.displayName}
                              </div>
                              <div className="font-mono text-[10px] text-[--label-2]">
                                {it.fcuNid}
                              </div>
                            </div>
                            <Pill color={b.color}>{b.label}</Pill>
                          </div>
                          {detail && (
                            <div className="mt-1 break-words pl-[42px] text-[11px] text-[--label-2]">
                              {detail}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}
