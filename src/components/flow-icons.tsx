import type { SVGProps } from "react";

export type IconName =
  | "grid" | "projects" | "products" | "camera" | "approvals" | "services" | "billing" | "messages" | "reports" | "settings" | "team" | "clients" | "production" | "marketplace" | "search" | "plus" | "arrow" | "chevron" | "menu" | "bell" | "download" | "upload" | "calendar" | "clock" | "check" | "close" | "filter" | "spark" | "folder" | "file" | "globe" | "logout" | "dots" | "external" | "shield" | "mail" | "phone" | "user" | "refresh" | "send" | "edit" | "link" | "cameraPlus" | "arrowUp" | "receipt" | "circle";

const paths: Record<IconName, string[]> = {
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  projects: ["M3.5 6.5h17v13h-17z", "M3.5 10.5h17", "M8 6.5V4h8v2.5"],
  products: ["m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z", "m3.7 7.7 8.3 4.5 8.3-4.5", "M12 12.2V21", "m7.6 5.4 8.5 4.6"],
  camera: ["M4 7h3l1.5-2h7L17 7h3v12H4z", "M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"],
  approvals: ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z", "m9 12 2 2 4-4"],
  services: ["M4 7h16", "M4 12h16", "M4 17h16", "M7 4v6", "M17 9v6"],
  billing: ["M4 5h16v14H4z", "M4 9h16", "M8 14h4"],
  messages: ["M21 11.5a7.5 7.5 0 0 1-7.5 7.5 7.8 7.8 0 0 1-3.2-.7L4 20l1.8-5.1a7.4 7.4 0 0 1-.8-3.4A7.5 7.5 0 0 1 12.5 4H13a7.5 7.5 0 0 1 8 7.5Z", "M8.5 12h.01", "M12.5 12h.01", "M16.5 12h.01"],
  reports: ["M4 19V5", "M4 19h17", "m7 15 3-4 3 2 5-7", "M18 6h2v2"],
  settings: ["M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-1.7 2.9-.2-.1a1.8 1.8 0 0 0-1.8-.1 1.8 1.8 0 0 0-1 1.4v.2h-3.4V21a1.8 1.8 0 0 0-1.1-1.4 1.8 1.8 0 0 0-1.8.1l-.2.1-1.7-2.9.1-.1A1.7 1.7 0 0 0 7.4 15a1.7 1.7 0 0 0-1.5-.9h-.2v-3.3h.2A1.7 1.7 0 0 0 7.4 10a1.7 1.7 0 0 0-.3-1.8L7 8.1l1.7-2.9.2.1a1.8 1.8 0 0 0 1.8.1 1.8 1.8 0 0 0 1-1.4v-.2h3.4V4a1.8 1.8 0 0 0 1.1 1.4 1.8 1.8 0 0 0 1.8-.1l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5.9h.2v3.3h-.2a1.7 1.7 0 0 0-1.6.8Z"],
  team: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M20 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  clients: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M20 8v6", "M17 11h6"],
  production: ["M4 4h16v16H4z", "M8 8h8", "M8 12h5", "M8 16h3", "m15 15 2 2 4-5"],
  marketplace: ["M3 9h18", "M5 9v11h14V9", "M4 9l1.5-5h13L20 9", "M9 20v-6h6v6"],
  search: ["M10.8 18.5a7.7 7.7 0 1 0 0-15.4 7.7 7.7 0 0 0 0 15.4Z", "m16.5 16.5 4 4"],
  plus: ["M12 5v14", "M5 12h14"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  chevron: ["m9 18 6-6-6-6"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 20h14"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M5 20h14"],
  calendar: ["M4 5h16v16H4z", "M8 3v4", "M16 3v4", "M4 10h16"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
  check: ["m5 12 4 4L19 6"],
  close: ["m18 6-12 12", "m6 6 12 12"],
  filter: ["M4 5h16", "M7 12h10", "M10 19h4"],
  spark: ["m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z", "m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z"],
  folder: ["M3 6h7l2 2h9v11H3z", "M3 8h18"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h6"],
  globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M2 12h20", "M12 2a15 15 0 0 1 0 20", "M12 2a15 15 0 0 0 0 20"],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"],
  dots: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  external: ["M14 3h7v7", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  shield: ["M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z", "M9 12h6"],
  mail: ["M3 5h18v14H3z", "m3 7 9 6 9-6"],
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7l.5 2.9a2 2 0 0 1-.6 1.8L8.2 9.8a16 16 0 0 0 6 6l1.4-1.8a2 2 0 0 1 1.8-.6l2.9.5a2 2 0 0 1 1.7 2Z"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  refresh: ["M20 7v5h-5", "M4 17v-5h5", "M5.6 9a7 7 0 0 1 11.6-2L20 12", "M18.4 15a7 7 0 0 1-11.6 2L4 12"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"],
  link: ["M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7", "M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"],
  cameraPlus: ["M4 7h3l1.5-2h7L17 7h3v12H4z", "M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z", "M19 3v4", "M17 5h4"],
  arrowUp: ["M12 19V5", "m6 11 6-6 6 6"],
  receipt: ["M5 3h14v18l-3-2-4 2-4-2-3 2z", "M8 8h8", "M8 12h8", "M8 16h4"],
  circle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"],
};

export function Icon({ name, size = 18, strokeWidth = 1.7, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name].map((path, index) => <path d={path} key={index} />)}
    </svg>
  );
}
