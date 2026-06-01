/**
 * Shared types for the FCU "行動逢甲" read-only feature replicas.
 *
 * Every feature fetch returns a discriminated FeatureResult so the UI can
 * render either the data or a friendly error without throwing.
 */

export type FeatureResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** A decrypted account ready to talk to FCU. Never logged, never sent to the client. */
export type FcuCredential = {
  id: string;
  displayName: string;
  fcuNid: string;
  password: string;
};

// ---- 課表 Timetable ----

export type TimetableSlot = {
  subId: string;
  subName: string; // 中文課名 (from TimetableTw)
  room: string; // RomName
  periodTime: string; // "09:10~10:00"
  week: number; // SctWeek: 1=Mon … 7=Sun, 0=未排定/整日
  period: number; // SctPeriod: 1..n
  color: string; // ColorCode (#RRGGBB)
};

export type Timetable = {
  studentNo: string;
  year: number; // 學年 e.g. 114
  semester: number; // 學期 1/2/3
  slots: TimetableSlot[]; // 已排定 (week 1..7, period >= 1)
  unscheduled: TimetableSlot[]; // week 0 或沒有 periodTime 的課
};

// ---- 電子學生證 Student Card ----

export type StudentCard = {
  name: string;
  studentNo: string; // cardInfo.id
  deptName: string; // userInfo.cls_uname
  cardType: string; // "學 生 證"
  barcode: string;
  semesterLabel: string; // e.g. "114 (下) / 2026 Spring"
  qrDataUrl: string; // data:image/...;base64 of the official QR
  photoDataUrl: string | null; // data:image/...;base64 of the student photo
};

// ---- 請假 / 缺曠 Absence ----

export type AbsenceRecord = {
  date: string; // "2026/03/05"
  subName: string;
  period: string; // abs_period "2"
  kind: string; // abs_kind 缺課/...
  reason: string; // abs_name 事假/...
  teacher: string; // emp_name
  clsName: string; // cls_name 光電二乙
};

// ---- 考試課表 Exam schedule ----

export type ExamCourse = {
  label: string; // unCentraData[].x 中文標籤
};

export type ExamSchedule = {
  semesterLabel: string; // ymsData e.g. "1142"
  courses: ExamCourse[];
};
