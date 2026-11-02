import type { Chapter } from "@/lib/chapters";

export default function ChapterScene({ chapter }: { chapter: Chapter }) {
  const { scene } = chapter;
  const colors = {
    fire: ["#200b14", "#dc6537", "#32141c"],
    ocean: ["#0b293e", "#6ca9b0", "#0c474a"],
    ice: ["#7d9bac", "#dde5d7", "#40566c"],
    forest: ["#152f32", "#b9ad79", "#193f32"],
    desert: ["#6e4940", "#dcc18f", "#573c32"],
    impact: ["#19172b", "#d19160", "#292b32"],
  }[scene];
  return (
    <div className={`chapter-scene scene-${scene}`}>
      <svg
        viewBox="0 0 600 330"
        role="img"
        aria-label={`Original illustrative ${scene} landscape; not a scientific reconstruction`}
      >
        <defs>
          <linearGradient id={`sky-${chapter.id}`} x2="0" y2="1">
            <stop stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
          <linearGradient id={`ground-${chapter.id}`} x2="0" y2="1">
            <stop stopColor={colors[2]} />
            <stop offset="1" stopColor="#09141a" />
          </linearGradient>
          <filter id={`blur-${chapter.id}`}>
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <rect width="600" height="330" fill={`url(#sky-${chapter.id})`} />
        <circle
          cx="430"
          cy="85"
          r={scene === "fire" ? 45 : 30}
          fill={colors[1]}
          opacity=".65"
          filter={`url(#blur-${chapter.id})`}
        />
        <path
          d="M0 220 65 156 112 186 195 80 273 179 345 118 415 184 510 140 600 209V330H0Z"
          fill={colors[2]}
          opacity=".5"
        />
        <path
          d="m0 260 97-76 81 49 83-43 110 65 88-56 141 43v88H0Z"
          fill={`url(#ground-${chapter.id})`}
        />
        {scene === "ice" && (
          <path d="m112 186 83-106 78 99-52-28-27 12-24-15Z" fill="#dbe8e8" />
        )}
        {scene === "ocean" && (
          <>
            <path
              d="M0 228Q150 215 300 230T600 228V330H0Z"
              fill="#286a78"
              opacity=".8"
            />
            <g stroke="#a9d8d1" opacity=".25">
              {[248, 265, 290, 318].map((y) => (
                <path d={`M0 ${y}Q150 ${y - 10} 300 ${y}T600 ${y}`} key={y} />
              ))}
            </g>
          </>
        )}
        {scene === "forest" && (
          <g fill="#102b26">
            {Array.from({ length: 15 }, (_, i) => {
              const x = i * 47 - 20,
                h = 70 + ((i * 37) % 110);
              return (
                <g key={i}>
                  <path d={`M${x} 330v-${h}h5v${h}Z`} />
                  <path d={`m${x + 2} ${330 - h - 23}-27 60h54Z`} />
                  <path d={`m${x + 2} ${330 - h + 2}-37 67h74Z`} />
                </g>
              );
            })}
          </g>
        )}
        {scene === "fire" && (
          <>
            <path d="m124 265 71-185 78 99-52-28-26-12-22 18Z" fill="#35232a" />
            <path
              d="m189 108 7 44 24 31 16 72"
              fill="none"
              stroke="#f09447"
              strokeWidth="8"
            />
            <ellipse
              className="scene-glow"
              cx="197"
              cy="83"
              rx="50"
              ry="13"
              fill="#ffb468"
              opacity=".6"
            />
          </>
        )}
        {scene === "impact" && (
          <g className="scene-meteor">
            <path d="m490 0-151 183" stroke="#f6d2a2" strokeWidth="4" />
            <path
              d="m520 0-181 183"
              stroke="#d28b62"
              strokeWidth="14"
              opacity=".4"
            />
            <circle cx="339" cy="183" r="8" fill="#fff1d2" />
          </g>
        )}
      </svg>
      <span className="scene-caption">
        Original illustration · not to scale
      </span>
    </div>
  );
}
