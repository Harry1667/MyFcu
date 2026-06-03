// Stroke-based line icons (Lucide-style), 24px viewBox, currentColor.
// Replaces emoji across the app for a consistent, non-toy look.

type IconProps = { className?: string; size?: number };

function Svg({ className, size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function IconUnlock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </Svg>
  );
}

export function IconKey(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13l8-8M15 8l2 2M18 5l2 2" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  );
}

export function IconCameraSwitch(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8v4h4M21 16v-4h-4" />
      <path d="M6.5 9.5A6 6 0 0 1 18 11M17.5 14.5A6 6 0 0 1 6 13" />
    </Svg>
  );
}

export function IconFlashlight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3h6v3l-1 2v4h-4V8L9 6z" />
      <path d="M10 12h4v7a2 2 0 0 1-4 0z" />
    </Svg>
  );
}

export function IconWarning(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}

export function IconCheckCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconUserPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M17 9v6M14 12h6" />
    </Svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M16.5 20a5.5 5.5 0 0 0-2-4.3" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Svg>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 5l5 5M4 20l1-4L16 5l3 3L8 19z" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />
    </Svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01" />
    </Svg>
  );
}
