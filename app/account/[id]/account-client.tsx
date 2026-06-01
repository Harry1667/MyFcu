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
  const startedRef = useRef<Set<TabKey>>(new Set());

  const load = (key: TabKey) => {
    startedRef.current.add(key);
    setTabs((t) => ({ ...t, [key]: { status: 'loading' } }));
    startTransition(async () => {
      const result = await LOADERS[key](account.id);
      setTabs((t) => ({ ...t, [key]: { status: 'done', result } }));
    });
  };

  useEffect(() => {
    if (!startedRef.current.has(active)) load(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const current = tabs[active];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="pt-2">
        <Link href="/" className="-ml-1 flex w-fit items-center text-[17px] text-[--tint]">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" className="mr-0.5">
            <path
              d="M9 1.5L2 9l7 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          帳號
        </Link>
        <div className="mt-2 flex items-baseline gap-2">
          <h1 className="ios-title">{account.displayName}</h1>
          <span className="font-mono text-[13px] text-[--label-2]">{account.fcuNid}</span>
        </div>
      </header>

      <nav className="ios-segment mt-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-active={active === t.key}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-5 flex-1">
        {current.status === 'idle' || current.status === 'loading' ? (
          <Loading />
        ) : current.result && !current.result.ok ? (
          <ErrorBox message={current.result.error} onRetry={() => load(active)} />
        ) : (
          current.result &&
          current.result.ok && (
            <Panel tab={active} data={current.result.data} onRefresh={() => load(active)} />
          )
        )}
      </section>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-[--label-2]">
      <div
        className="h-7 w-7 animate-spin rounded-full border-[2.5px]"
        style={{ borderColor: 'var(--fill-strong)', borderTopColor: 'var(--tint)' }}
      />
      <span className="text-[15px]">查詢中…（連線 FCU）</span>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ios-card px-5 py-8 text-center">
      <p className="text-[15px] text-[--label]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full bg-[--fill] px-5 py-2 text-[15px] font-medium text-[--tint]"
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
  const maxWeek = data.slots.reduce((m, s) => Math.max(m, s.week), 5);
  const days = Array.from({ length: Math.min(Math.max(maxWeek, 5), 7) }, (_, i) => i + 1);
  const periods = [...new Set(data.slots.map((s) => s.period))].sort((a, b) => a - b);
  const cell = new Map<string, (typeof data.slots)[number]>();
  for (const s of data.slots) cell.set(`${s.week}-${s.period}`, s);

  return (
    <div>
      <p className="ios-section">
        {data.year} 學年 第 {data.semester} 學期
      </p>
      {periods.length === 0 ? (
        <div className="ios-card py-12 text-center text-[15px] text-[--label-2]">
          這學期沒有排定的課表。
        </div>
      ) : (
        <div className="ios-card overflow-x-auto p-1.5">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="w-6 p-1 font-medium text-[--label-3]" />
                {days.map((d) => (
                  <th key={d} className="p-1 font-semibold text-[--label-2]">
                    {DAY_LABELS[d - 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p}>
                  <td className="p-1 text-center align-middle font-semibold text-[--label-3]">
                    {p}
                  </td>
                  {days.map((d) => {
                    const s = cell.get(`${d}-${p}`);
                    return (
                      <td key={d} className="p-0.5 align-top">
                        {s && (
                          <div
                            className="h-full rounded-md px-1 py-1 leading-tight"
                            style={{
                              backgroundColor: `${s.color}26`,
                              boxShadow: `inset 2px 0 0 ${s.color}`,
                            }}
                          >
                            <div className="font-semibold text-[--label]">{s.subName}</div>
                            {s.room && <div className="text-[10px] text-[--label-2]">{s.room}</div>}
                          </div>
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
        <div className="mt-5">
          <h3 className="ios-section">未排定 / 整日課程</h3>
          <ul className="ios-card">
            {data.unscheduled.map((s, i) => (
              <li key={`${s.subId}-${i}`} className="relative px-4 py-2.5">
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-4" />}
                <span className="text-[15px] text-[--label]">{s.subName}</span>
                {s.room && <span className="ml-2 text-[13px] text-[--label-2]">{s.room}</span>}
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
      <div className="ios-card p-5">
        <div className="flex items-center gap-4">
          {data.photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoDataUrl}
              alt={data.name}
              className="h-[88px] w-[68px] rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-[88px] w-[68px] items-center justify-center rounded-xl bg-[--fill] text-2xl font-bold text-[--label-2]">
              {data.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[22px] font-bold text-[--label]">{data.name}</div>
            <div className="truncate text-[15px] text-[--label-2]">{data.deptName}</div>
            <div className="mt-1 font-mono text-[13px] text-[--label-3]">{data.studentNo}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center rounded-xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} alt="電子學生證 QR" className="h-52 w-52" />
          {data.barcode && (
            <div className="mt-3 font-mono text-[13px] tracking-[0.2em] text-zinc-500">
              {data.barcode}
            </div>
          )}
        </div>
        {data.semesterLabel && (
          <div className="mt-3 text-center text-[13px] text-[--label-2]">{data.semesterLabel}</div>
        )}
      </div>

      <button type="button" onClick={onRefresh} className="ios-btn-secondary">
        重新整理 QR
      </button>
      <p className="px-2 text-center text-[12px] text-[--label-3]">
        QR 為伺服器即時加密產生，短時間後可能失效，刷卡前請重新整理。
      </p>
    </div>
  );
}

// ---- 請假 / 缺曠 ----

function AbsenceView({ data }: { data: AbsenceRecord[] }) {
  if (data.length === 0) {
    return (
      <div className="ios-card py-12 text-center text-[15px] text-[--label-2]">
        目前沒有缺曠紀錄 🎉
      </div>
    );
  }
  const byDate = new Map<string, AbsenceRecord[]>();
  for (const r of data) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      {dates.map((date) => (
        <div key={date}>
          <h3 className="ios-section">{date}</h3>
          <ul className="ios-card">
            {byDate.get(date)!.map((r, i) => (
              <li
                key={`${r.subName}-${r.period}-${i}`}
                className="relative flex items-center justify-between px-4 py-2.5"
              >
                {i > 0 && <span className="ios-divider absolute top-0 right-0 left-4" />}
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-[--label]">{r.subName}</div>
                  <div className="text-[12px] text-[--label-2]">
                    第 {r.period} 節 · {r.clsName} · {r.teacher}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-[--fill] px-2.5 py-1 text-[12px] font-medium text-[--amber]">
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
    return (
      <div className="ios-card py-12 text-center text-[15px] text-[--label-2]">
        查無考試課表資料。
      </div>
    );
  }
  return (
    <div>
      {data.semesterLabel && <p className="ios-section">學期 {data.semesterLabel}</p>}
      <ul className="ios-card">
        {data.courses.map((c, i) => (
          <li key={i} className="relative px-4 py-2.5 text-[15px] text-[--label]">
            {i > 0 && <span className="ios-divider absolute top-0 right-0 left-4" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
