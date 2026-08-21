import React from "react";

const P: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  kanban: <><rect x="3" y="4" width="5.5" height="16" rx="1.5" /><rect x="9.25" y="4" width="5.5" height="10" rx="1.5" /><rect x="15.5" y="4" width="5.5" height="13" rx="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3.3 2.7-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.6 14.6c2.7.1 4.4 1.6 4.9 4.4" /></>,
  building: <><path d="M4 21V5.5L12 3v18" /><path d="M12 7l8 2.5V21" /><path d="M2.5 21h19" /><path d="M7 8.5h2M7 12h2M7 15.5h2M15 12.5h2M15 16h2" /></>,
  hammer: <><path d="m14 4 6 6-2.5 2.5-6-6z" /><path d="M11.5 6.5 4 14l3.5 3.5L15 10" /><path d="m14 4-2-2L8.5 5.5l2 2" /></>,
  checkSq: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12.5 2.8 2.8L16.5 9" /></>,
  box: <><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></>,
  wallet: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9" /><rect x="3" y="8" width="18" height="12" rx="2.5" /><circle cx="16.5" cy="14" r="1.3" fill="currentColor" stroke="none" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 12H1.8M22.2 12h-2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <><path d="M18 15.5H6c1.2-1.3 1.5-3 1.5-5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 4.5 4.5c0 2 .3 3.7 1.5 5Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /><path d="M12 3.5V6" /></>,
  volume: <><path d="M11.5 5 7 9H4v6h3l4.5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.3 6a9 9 0 0 1 0 12" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  chevR: <path d="m9 6 6 6-6 6" />,
  chevL: <path d="m15 6-6 6 6 6" />,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  panelL: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></>,
  cloud: <path d="M7 18a4.5 4.5 0 1 1 .7-8.95A6 6 0 0 1 19.3 10.5 3.75 3.75 0 0 1 18 18H7Z" />,
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13L13 2Z" />,
  sparkle: <><path d="M12 4c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" /><path d="M19 15c.3 1.7 1 2.4 2.7 2.7-1.7.3-2.4 1-2.7 2.7-.3-1.7-1-2.4-2.7-2.7 1.7-.3 2.4-1 2.7-2.7Z" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 1.9" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20.5c.8-3.8 3.4-5.7 7-5.7s6.2 1.9 7 5.7" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  firm: <><rect x="3.5" y="7" width="17" height="13.5" rx="2" /><path d="M8.5 7V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2V7" /><path d="M3.5 12.5h17" /><path d="M10.5 12.5v2h3v-2" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5 7.5 20.5h9L17.5 6.5" /><path d="M10 10.5v6M14 10.5v6" /></>,
  pencil: <><path d="m14.5 5.5 4 4L8 20H4v-4Z" /><path d="m12.5 7.5 4 4" /></>,
  check: <path d="m5 13 4.5 4.5L19 7" />,
  alert: <><path d="M12 3.5 2.5 20h19Z" /><path d="M12 9.5V14" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
  logout: <><path d="M14.5 8V5.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V16" /><path d="M9 12h11.5M17 8.5l3.5 3.5-3.5 3.5" /></>,
  grid: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.5" /></>,
  list: <><path d="M8.5 6h12M8.5 12h12M8.5 18h12" /><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  ruble: <><path d="M8.5 20V4.5H14a4 4 0 0 1 0 8H6.5" /><path d="M6.5 16h7" /></>,
  arrowR: <path d="M4 12h15M13.5 6l6 6-6 6" />,
  link: <><path d="M10 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7L11.5 7.5" /><path d="M14 10a4 4 0 0 0-6-.5L5.5 12a4 4 0 0 0 5.7 5.7l1.3-1.2" /></>,
  note: <><path d="M5 4.5h14v11l-4 4H5Z" /><path d="M15 19.5v-4h4" /><path d="M8.5 9h7M8.5 12.5H13" /></>,
  funnel: <><path d="M3.5 5h17l-6.5 7.5v5.5l-4 2v-7.5Z" /></>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2.5 12S6 5.5 12 5.5c1.5 0 2.9.4 4.1 1M21.5 12S18 18.5 12 18.5c-1.5 0-2.9-.4-4.1-1" /><path d="m4 4 16 16" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14v2" /></>,
  shield: <><path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6Z" /><path d="m8.8 12 2.3 2.3 4.2-4.6" /></>,
  crane: <><path d="M4 21h16M6 21V8M6 8 18 5v3M6 8l6-1.5M18 8v3M16.5 11h3M18 13.5v1.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  send: <><path d="m4 11 16-7-5.5 16-2.8-6.2Z" /><path d="m11.7 13.8 4-4" /></>,
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
};

export function Icon({ name, size = 18, className = "", sw = 1.7 }: { name: string; size?: number; className?: string; sw?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {P[name]}
    </svg>
  );
}
