// src/icons.jsx — inline SVG icons, dependency-free.
// One visual vocabulary for the whole dashboard: each flow family and each
// Redemption concept gets a recognisable mark. Stroke-based to match the
// existing LinkIcon; LinkedIn is the one filled glyph, for brand legibility.
// Every icon inherits `currentColor`, so colour comes from the parent.

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };

export function MailIcon({ size = 19 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="M3 6.5l9 6 9-6" /></svg>);
}

// LinkedIn — filled glyph (a stroke version reads poorly at this size).
export function LinkedInIcon({ size = 19 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" /></svg>);
}

export function ContentIcon({ size = 19 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></svg>);
}

export function LockIcon({ size = 19 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>);
}

export function GearIcon({ size = 19 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>);
}

// Redemption concepts
export function ReplyIcon({ size = 17 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><polyline points="9 14 4 9 9 4" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></svg>);
}

export function RegisteredIcon({ size = 17 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>);
}

export function PersonIcon({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0 1 14 0v1" /></svg>);
}

export function CompanyIcon({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></svg>);
}

export function LicenceIcon({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1.8 1.8 0 0 0 0 5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1.8 1.8 0 0 0 0-5z" /><path d="M9.5 6.5v11" strokeDasharray="1.6 2.2" /></svg>);
}

export function ConnectIcon({ size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><circle cx="7" cy="12" r="3" /><circle cx="17" cy="12" r="3" /><path d="M10 12h4" /></svg>);
}

// Chart / section marks
export function BarsIcon({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M3 21h18" /><rect x="5" y="11" width="3.5" height="7" /><rect x="10.5" y="6" width="3.5" height="12" /><rect x="16" y="14" width="3.5" height="4" /></svg>);
}

export function FlameIcon({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M12 3s5 4.5 5 9.5A5 5 0 0 1 7 12.5c0-1.6.7-3 1.6-4C9 10 10 10.5 11 10c-.5-2.5 1-4.7 1-7z" /></svg>);
}

export function ActivityIcon({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><polyline points="3 12 7 12 10 5 14 19 17 12 21 12" /></svg>);
}

export function MonitorIcon({ size = 18 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" {...base}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></svg>);
}

// Map a flow family letter to its mark.
export function FamilyIcon({ family, size = 19 }) {
  switch (family) {
    case "A": return <MailIcon size={size} />;
    case "B": return <LinkedInIcon size={size} />;
    case "C": return <ContentIcon size={size} />;
    case "D": return <LockIcon size={size} />;
    default:  return <GearIcon size={size} />;
  }
}
