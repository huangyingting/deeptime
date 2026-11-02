export type IconName =
  | "pin"
  | "layers"
  | "sources"
  | "share"
  | "sound"
  | "muted"
  | "play"
  | "pause"
  | "close"
  | "previous"
  | "next";
const paths: Record<IconName, string[]> = {
  pin: [
    "M10 18s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10Z",
    "M12 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  ],
  layers: ["m10 3 7 4-7 4-7-4 7-4Z", "m3 11 7 4 7-4", "m3 15 7 4 7-4"],
  sources: ["M4 3h9l3 3v11H4Z", "M7 8h6M7 11h6M7 14h4"],
  share: [
    "m8 12 4-4",
    "m9 6 2-2a3 3 0 0 1 4 4l-2 2",
    "m11 14-2 2a3 3 0 0 1-4-4l2-2",
  ],
  sound: [
    "M3 8v4h3l4 3V5L6 8H3Z",
    "M13 7a4 4 0 0 1 0 6",
    "M15 5a7 7 0 0 1 0 10",
  ],
  muted: ["M3 8v4h3l4 3V5L6 8H3Z", "m13 8 4 4m0-4-4 4"],
  play: ["m7 4 9 6-9 6Z"],
  pause: ["M6 4h3v12H6ZM12 4h3v12h-3Z"],
  close: ["m5 5 10 10M15 5 5 15"],
  previous: ["m12 4-6 6 6 6"],
  next: ["m8 4 6 6-6 6"],
};

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {paths[name].map((path, i) => (
        <path d={path} key={i} />
      ))}
    </svg>
  );
}
