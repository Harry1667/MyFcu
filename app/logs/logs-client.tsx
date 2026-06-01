'use client';

import { useState, useTransition } from 'react';
import { clearActivity, clearLogs } from '@/lib/actions/logs';

const ACTIVITY_LABEL: Record<Activity['type'], string> = {
  clockin: '打卡',
  account_add: '新增帳號',
  account_delete: '刪除帳號',
  group_create: '建立群組',
  group_update: '修改群組',
  group_delete: '刪除群組',
};

/** Build a UTF-8 CSV (with BOM so Excel renders Chinese) and trigger a download. */
function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp() {
  // Local YYYYMMDD-HHmm for the filename.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

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

type Activity = {
  id: string;
  type:
    | 'clockin'
    | 'account_add'
    | 'account_delete'
    | 'group_create'
    | 'group_update'
    | 'group_delete';
  summary: string;
  detail: string | null;
  createdAt: Date;
};

const ACTIVITY_ICON: Record<Activity['type'], string> = {
  clockin: '📷',
  account_add: '➕',
  account_delete: '🗑️',
  group_create: '👥',
  group_update: '✏️',
  group_delete: '🗑️',
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
  activities,
}: {
  sessions: Session[];
  totalCount: number;
  activities: Activity[];
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'clockin' | 'activity'>('clockin');

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  const handleClear = () => {
    if (!confirm(`刪除全部 ${totalCount} 筆打卡紀錄？`)) return;
    startTransition(async () => {
      await clearLogs();
    });
  };

  const exportClockin = () => {
    const rows: (string | number | null)[][] = [
      ['時間', '姓名', '學號', '送出', '驗證', '訊息', 'QR token'],
    ];
    for (const s of sessions) {
      for (const it of s.items) {
        rows.push([
          s.createdAt.toLocaleString('zh-TW', { hour12: false }),
          it.displayName,
          it.fcuNid,
          it.status === 'sent' ? '已送出' : '失敗',
          it.verified === true ? '已記錄' : it.verified === false ? '未確認' : '',
          it.verifyMessage ?? it.errorMessage ?? '',
          s.token,
        ]);
      }
    }
    downloadCsv(`打卡紀錄-${stamp()}.csv`, rows);
  };

  return (
    <>
      <nav className="ios-segment mt-4">
        <button type="button" data-active={view === 'clockin'} onClick={() => setView('clockin')}>
          打卡
        </button>
        <button type="button" data-active={view === 'activity'} onClick={() => setView('activity')}>
          操作
        </button>
      </nav>

      {view === 'activity' ? (
        <ActivityFeed activities={activities} />
      ) : sessions.length === 0 ? (
        <div className="ios-card mt-4 px-6 py-12 text-center text-[15px] text-[--label-2]">
          還沒有打卡紀錄。掃過 QR 之後會自動寫進來。
        </div>
      ) : (
        <>
          <div className="mt-4 mb-2 flex items-center justify-between px-1 text-[13px] text-[--label-2]">
            <span>
              共 {sessions.length} 次掃描、{totalCount} 筆
            </span>
            <div className="flex items-center gap-4">
              <button type="button" onClick={exportClockin} className="font-medium text-[--tint]">
                匯出
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={pending}
                className="font-medium text-[--danger]"
              >
                清空
              </button>
            </div>
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
      )}
    </>
  );
}

function ActivityFeed({ activities }: { activities: Activity[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  if (activities.length === 0) {
    return (
      <div className="ios-card mt-4 px-6 py-12 text-center text-[15px] text-[--label-2]">
        還沒有操作紀錄。新增帳號、建群組、打卡都會記在這裡。
      </div>
    );
  }
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportActivity = () => {
    const rows: (string | number | null)[][] = [['時間', '類型', '內容', '詳細']];
    for (const a of activities) {
      rows.push([
        a.createdAt.toLocaleString('zh-TW', { hour12: false }),
        ACTIVITY_LABEL[a.type],
        a.summary,
        a.detail ?? '',
      ]);
    }
    downloadCsv(`操作紀錄-${stamp()}.csv`, rows);
  };

  const clear = () => {
    if (!confirm(`刪除全部 ${activities.length} 筆操作紀錄？`)) return;
    startTransition(async () => {
      await clearActivity();
    });
  };

  return (
    <>
      <div className="mt-4 mb-2 flex items-center justify-between px-1 text-[13px] text-[--label-2]">
        <span>共 {activities.length} 筆操作</span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={exportActivity} className="font-medium text-[--tint]">
            匯出
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="font-medium text-[--danger]"
          >
            清空
          </button>
        </div>
      </div>
      <ul className="ios-card">
      {activities.map((a, i) => {
        const isOpen = open.has(a.id);
        const hasDetail = !!a.detail;
        return (
          <li key={a.id} className="relative">
            {i > 0 && <span className="ios-divider absolute top-0 right-0 left-[52px]" />}
            <button
              type="button"
              onClick={() => hasDetail && toggle(a.id)}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left active:bg-[--fill]"
            >
              <span className="mt-0.5 text-[18px] leading-none">{ACTIVITY_ICON[a.type]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-[--label]">{a.summary}</span>
                <span className="block text-[12px] text-[--label-2]">
                  {a.createdAt.toLocaleString('zh-TW', { hour12: false })} · {timeAgo(a.createdAt)}
                </span>
              </span>
              {hasDetail && (
                <span className={`mt-1 text-[--label-3] transition ${isOpen ? 'rotate-90' : ''}`}>
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
              )}
            </button>
            {isOpen && hasDetail && (
              <pre className="mx-3 mb-3 overflow-x-auto rounded-lg bg-[--fill] px-3 py-2 font-mono text-[11px] break-all whitespace-pre-wrap text-[--label-2]">
                {prettyDetail(a.detail!)}
              </pre>
            )}
          </li>
        );
      })}
      </ul>
    </>
  );
}

function prettyDetail(detail: string): string {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
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
