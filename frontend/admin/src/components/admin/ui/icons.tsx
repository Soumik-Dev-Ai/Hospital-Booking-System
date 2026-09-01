import type { ItemKind, ServiceIconId } from "@/lib/mock";

export interface IconProps {
  className?: string;
}

function Svg({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ––––– Generic UI icons ––––– */

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </Svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 2.8v4M16 2.8v4" />
    </Svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m6 9.5 6 6 6-6" />
    </Svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m14.5 6-6 6 6 6" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.8 2.8 19.5h18.4L12 3.8Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.4 2.4 4.8-5" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3.5 19.5c.7-3.6 2.7-5.4 5.5-5.4s4.8 1.8 5.5 5.4" />
      <path d="M15.5 5.6a3.5 3.5 0 0 1 0 5.8M17.5 14.6c1.5.9 2.5 2.4 3 4.9" />
    </Svg>
  );
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
      <rect x="9" y="2.8" width="6" height="3.4" rx="1.2" />
      <path d="M8.5 11h7M8.5 15h4.5" />
    </Svg>
  );
}

export function PillIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="9" width="17" height="6.5" rx="3.2" transform="rotate(-32 12 12.25)" />
      <path d="m9.2 10.3 5.6 9.4" />
    </Svg>
  );
}

export function FlaskIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9.5 3.5h5M10.5 3.5v5.1L5.3 18a2.4 2.4 0 0 0 2.1 3.6h9.2a2.4 2.4 0 0 0 2.1-3.6L13.5 8.6V3.5" />
      <path d="M7.5 14.5h9" />
    </Svg>
  );
}

export function FileTextIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5h-.5Z" />
      <path d="M13.5 3.5V8H18M8.5 12h7M8.5 15.5h5" />
    </Svg>
  );
}

export function StethoscopeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 4.5v5a4.5 4.5 0 0 0 9 0v-5" />
      <path d="M3.5 5.5H6M13 5.5h2.5" />
      <path d="M19 9.5V12a5.5 5.5 0 0 1-11 0" />
      <circle cx="19.2" cy="7" r="2.3" />
    </Svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6.8 3.5h3l1.4 4-2 1.5a12.5 12.5 0 0 0 5.8 5.8l1.5-2 4 1.4v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.8 5.7a2 2 0 0 1 2-2.2Z" />
    </Svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.2 19 6v5.2c0 4.6-3 7.8-7 9.6-4-1.8-7-5-7-9.6V6l7-2.8Z" />
      <path d="m9 11.7 2.2 2.2L15.5 9.5" />
    </Svg>
  );
}

export function DropletIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.2c3.6 4.4 6.2 7.5 6.2 10.4a6.2 6.2 0 0 1-12.4 0C5.8 10.7 8.4 7.6 12 3.2Z" />
      <path d="M9.4 13.4a2.6 2.6 0 0 0 2.6 2.6" />
    </Svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5c.7 4.4 2.1 5.8 6.5 6.5-4.4.7-5.8 2.1-6.5 6.5-.7-4.4-2.1-5.8-6.5-6.5 4.4-.7 5.8-2.1 6.5-6.5Z" />
    </Svg>
  );
}

export function LeafIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 4.5c-8.5-.4-13.9 3-15.5 10.6-.7 3.2-.2 4.9 1.2 4.9 1.2 0 1.9-1.1 2.9-3.1" />
      <path d="M4.5 20C8.5 12 12.5 8 20 4.5" />
    </Svg>
  );
}

/* ––––– Compliance kind icons ––––– */

export function KindIcon({
  kind,
  className,
}: {
  kind: ItemKind;
  className?: string;
}) {
  if (kind === "prescription") return <PillIcon className={className} />;
  if (kind === "lab") return <FlaskIcon className={className} />;
  return <ClipboardIcon className={className} />;
}

/* ––––– Service icons ––––– */

export function ServiceIcon({
  id,
  className,
}: {
  id: ServiceIconId;
  className?: string;
}) {
  switch (id) {
    case "mri":
      return (
        <Svg className={className}>
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="4.3" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <path d="M12 3.8v2.2" />
        </Svg>
      );
    case "xray":
      return (
        <Svg className={className}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <path d="M12 7v10M7 12h10" />
        </Svg>
      );
    case "ultrasound":
      return (
        <Svg className={className}>
          <rect x="8" y="3.2" width="5.5" height="6.3" rx="1.6" />
          <path d="M10.75 9.5v2.2" />
          <path d="M7.5 15a5.6 5.6 0 0 1 0 5.8M11 13.6a9 9 0 0 1 0 7.2M14.5 15a5.6 5.6 0 0 0 0 5.8" />
        </Svg>
      );
    case "ct":
      return (
        <Svg className={className}>
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3.6v2.4M12 18v2.4M3.6 12H6M18 12h2.4" />
        </Svg>
      );
    case "cardio":
      return (
        <Svg className={className}>
          <path d="M3.5 12.5h3.6l2-4.8 3.6 9.2 2.4-6 1.4 1.6h4" />
        </Svg>
      );
    case "blood":
      return (
        <Svg className={className}>
          <path d="M12 3.2c3.6 4.4 6.2 7.5 6.2 10.4a6.2 6.2 0 0 1-12.4 0C5.8 10.7 8.4 7.6 12 3.2Z" />
          <path d="M9.4 13.4a2.6 2.6 0 0 0 2.6 2.6" />
        </Svg>
      );
    case "physio":
      return (
        <Svg className={className}>
          <circle cx="12" cy="5" r="2.6" />
          <path d="M6.5 21c.6-4.6 2.2-7.2 5.5-7.2s4.9 2.6 5.5 7.2" />
          <path d="M8.6 8.6 7.2 11M15.4 8.6l1.4 2.4" />
        </Svg>
      );
    case "derm":
      return (
        <Svg className={className}>
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15.2 15.2 4.8 4.8" />
          <path d="M10.5 7.8v5.4M7.8 10.5h5.4" />
        </Svg>
      );
  }
}
