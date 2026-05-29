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
  return `hsl(${h % 360} 60% 55%)`;
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
  if (item.status === 'failed') {
    return { bg: 'bg-red-100', text: 'text-red-700', label: '送出失敗' };
  }
  if (item.verified === true) {
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '✓ 已記錄' };
  }
  if (item.verified === false) {
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: '⚠️ 未確認' };
  }
  return { bg: 'bg-zinc-100', text: 'text-zinc-600', label: '已送出' };
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
      <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
        <span>共 {sessions.length} 次掃描、{totalCount} 筆帳號紀錄</span>
        <button
          type="button"
          onClick={handleClear}
          disabled={pending}
          className="text-red-600 underline"
        >
          清空
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {sessions.map((s) => {
          const verified = s.items.filter((i) => i.verified === true).length;
          const unverified = s.items.filter(
            (i) => i.status === 'sent' && i.verified === false,
          ).length;
          const failed = s.items.filter((i) => i.status === 'failed').length;
          const isOpen = expanded.has(s.key);
          return (
            <li key={s.key} className="rounded-2xl bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => toggle(s.key)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="text-sm font-medium">
                    {s.createdAt.toLocaleString('zh-TW', { hour12: false })}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {timeAgo(s.createdAt)} · {s.items.length} 個帳號
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {verified > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      ✓ {verified}
                    </span>
                  )}
                  {unverified > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      ⚠️ {unverified}
                    </span>
                  )}
                  {failed > 0 && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      ✗ {failed}
                    </span>
                  )}
                  <span className="text-zinc-400">{isOpen ? '▾' : '▸'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">QR token</div>
                    <div className="mt-1 break-all font-mono text-xs">{s.token}</div>
                  </div>
                  <ul className="space-y-1">
                    {s.items.map((it) => {
                      const b = itemBadge(it);
                      const detail = it.verifyMessage ?? it.errorMessage;
                      return (
                        <li
                          key={it.id}
                          className="rounded-lg bg-zinc-50 px-2 py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: avatarColor(it.fcuNid) }}
                            >
                              {it.displayName.slice(0, 1)}
                            </span>
                            <div className="flex-1">
                              <div className="font-medium">{it.displayName}</div>
                              <div className="font-mono text-[10px] text-zinc-400">
                                {it.fcuNid}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.bg} ${b.text}`}
                            >
                              {b.label}
                            </span>
                          </div>
                          {detail && (
                            <div className="mt-1 break-words pl-9 text-[11px] text-zinc-500">
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
