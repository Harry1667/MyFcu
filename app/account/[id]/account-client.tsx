'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  getAbsence,
  getExamSchedule,
  getStudentCard,
  getTimetable,
} from '@/lib/actions/fcu-features';
import type {
  AbsenceRecord,
  ExamSchedule,
  FeatureResult,
  StudentCard,
  Timetable,
} from '@/lib/fcu/types';

type Account = { id: string; displayName: string; fcuNid: string };

type TabKey = 'timetable' | 'card' | 'absence' | 'exam';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'timetable', label: '課表' },
  { key: 'card', label: '學生證' },
  { key: 'absence', label: '請假缺曠' },
  { key: 'exam', label: '考試' },
];

// Per-tab loader bound to the matching server action.
const LOADERS: Record<TabKey, (id: string) => Promise<FeatureResult<unknown>>> = {
  timetable: getTimetable,
  card: getStudentCard,
  absence: getAbsence,
  exam: getExamSchedule,
};

type TabState = { status: 'idle' | 'loading' | 'done'; result?: FeatureResult<unknown> };

export function AccountPanel({ account }: { account: Account }) {
  const [active, setActive] = useState<TabKey>('timetable');
  const [tabs, setTabs] = useState<Record<TabKey, TabState>>({
    timetable: { status: 'idle' },
    card: { status: 'idle' },
    absence: { status: 'idle' },
    exam: { status: 'idle' },
  });
  const [, startTransition] = useTransition();
  // Track which tabs have been kicked off so the auto-load effect fires once each.
  const startedRef = useRef<Set<TabKey>>(new Set());

  const load = (key: TabKey) => {
    startedRef.current.add(key);
    setTabs((t) => ({ ...t, [key]: { status: 'loading' } }));
    startTransition(async () => {
      const result = await LOADERS[key](account.id);
      setTabs((t) => ({ ...t, [key]: { status: 'done', result } }));
    });
  };

  // Lazy-load the active tab the first time it's shown (including the default
  // tab on mount). Re-opening a loaded tab reuses the cached result.
  useEffect(() => {
    if (!startedRef.current.has(active)) load(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openTab = (key: TabKey) => setActive(key);

  const current = tabs[active];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{account.displayName}</h1>
          <p className="font-mono text-[11px] text-zinc-400">{account.fcuNid}</p>
        </div>
        <Link href="/" className="text-sm text-zinc-600 underline">
          返回
        </Link>
      </header>

      <nav className="mt-4 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => openTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              active === t.key
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-4 flex-1">
        {current.status === 'idle' || current.status === 'loading' ? (
          <Loading />
        ) : current.result && !current.result.ok ? (
          <ErrorBox message={current.result.error} onRetry={() => load(active)} />
        ) : (
          current.result &&
          current.result.ok && (
            <Panel
              tab={active}
              data={current.result.data}
              onRefresh={() => load(active)}
            />
          )
        )}
      </section>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
      <span className="text-sm">查詢中…（需連到 FCU，約數秒）</span>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl bg-red-50 px-4 py-6 text-center">
      <p className="text-sm text-red-700">⚠️ {message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"
      >
        重試
      </button>
    </div>
  );
}

function Panel({
  tab,
  data,
  onRefresh,
}: {
  tab: TabKey;
  data: unknown;
  onRefresh: () => void;
}) {
  switch (tab) {
    case 'timetable':
      return <TimetableView data={data as Timetable} />;
    case 'card':
      return <CardView data={data as StudentCard} onRefresh={onRefresh} />;
    case 'absence':
      return <AbsenceView data={data as AbsenceRecord[]} />;
    case 'exam':
      return <ExamView data={data as ExamSchedule} />;
  }
}

// ---- 課表 ----

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function TimetableView({ data }: { data: Timetable }) {
  // Which weekdays to show: always Mon–Fri, plus Sat/Sun only if they have classes.
  const maxWeek = data.slots.reduce((m, s) => Math.max(m, s.week), 5);
  const days = Array.from({ length: Math.min(Math.max(maxWeek, 5), 7) }, (_, i) => i + 1);

  const periods = [...new Set(data.slots.map((s) => s.period))].sort((a, b) => a - b);
  const cell = new Map<string, (typeof data.slots)[number]>();
  for (const s of data.slots) cell.set(`${s.week}-${s.period}`, s);
  const periodTime = new Map<number, string>();
  for (const s of data.slots) if (s.periodTime) periodTime.set(s.period, s.periodTime);

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">
        {data.year} 學年 第 {data.semester} 學期
      </p>
      {periods.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">這學期沒有排定的課表。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="w-7 border border-zinc-200 bg-zinc-50 p-1 font-medium text-zinc-400">
                  節
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="border border-zinc-200 bg-zinc-50 p-1 font-medium text-zinc-600"
                  >
                    {DAY_LABELS[d - 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p}>
                  <td className="border border-zinc-200 bg-zinc-50 p-1 text-center align-middle">
                    <div className="font-semibold text-zinc-600">{p}</div>
                  </td>
                  {days.map((d) => {
                    const s = cell.get(`${d}-${p}`);
                    return (
                      <td
                        key={d}
                        className="border border-zinc-200 p-1 align-top"
                        style={s ? { backgroundColor: `${s.color}22` } : undefined}
                      >
                        {s && (
                          <>
                            <div className="font-medium leading-tight text-zinc-800">
                              {s.subName}
                            </div>
                            {s.room && (
                              <div className="text-[10px] text-zinc-500">{s.room}</div>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.unscheduled.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold text-zinc-500">未排定 / 整日課程</h3>
          <ul className="space-y-1">
            {data.unscheduled.map((s, i) => (
              <li key={`${s.subId}-${i}`} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                <span className="font-medium">{s.subName}</span>
                {s.room && <span className="ml-2 text-zinc-400">{s.room}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- 學生證 ----

function CardView({ data, onRefresh }: { data: StudentCard; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {data.photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoDataUrl}
              alt={data.name}
              className="h-20 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-20 w-16 items-center justify-center rounded-lg bg-zinc-100 text-2xl font-bold text-zinc-400">
              {data.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold">{data.name}</div>
            <div className="truncate text-sm text-zinc-500">{data.deptName}</div>
            <div className="mt-1 font-mono text-xs text-zinc-400">{data.studentNo}</div>
            <div className="text-[11px] text-zinc-400">{data.cardType}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.qrDataUrl}
            alt="電子學生證 QR"
            className="h-48 w-48"
          />
          {data.barcode && (
            <div className="mt-2 font-mono text-xs tracking-widest text-zinc-500">
              {data.barcode}
            </div>
          )}
          {data.semesterLabel && (
            <div className="mt-1 text-[11px] text-zinc-400">{data.semesterLabel}</div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        🔄 重新整理 QR
      </button>
      <p className="text-center text-[11px] text-zinc-400">
        QR 為伺服器即時加密產生，短時間後可能失效，刷卡前請重新整理。
      </p>
    </div>
  );
}

// ---- 請假 / 缺曠 ----

function AbsenceView({ data }: { data: AbsenceRecord[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-400">目前沒有缺曠紀錄 🎉</p>;
  }
  // Group by date (newest first).
  const byDate = new Map<string, AbsenceRecord[]>();
  for (const r of data) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <div key={date}>
          <h3 className="mb-1 text-xs font-semibold text-zinc-500">{date}</h3>
          <ul className="space-y-1">
            {byDate.get(date)!.map((r, i) => (
              <li
                key={`${r.subName}-${r.period}-${i}`}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.subName}</div>
                  <div className="text-[11px] text-zinc-400">
                    第 {r.period} 節 · {r.clsName} · {r.teacher}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  {r.kind}
                  {r.reason && r.reason !== r.kind ? `·${r.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---- 考試 ----

function ExamView({ data }: { data: ExamSchedule }) {
  if (data.courses.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-400">查無考試課表資料。</p>;
  }
  return (
    <div>
      {data.semesterLabel && (
        <p className="mb-2 text-xs text-zinc-500">學期 {data.semesterLabel}</p>
      )}
      <ul className="space-y-1">
        {data.courses.map((c, i) => (
          <li key={i} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
