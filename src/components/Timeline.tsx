"use client";

import { useRef, useState, type PointerEvent } from "react";
import { chapters, type Chapter } from "@/lib/chapters";
import {
  ageToPosition,
  positionToAge,
  formatAge,
  periods,
  sample,
  type Climate,
} from "@/lib/earth";
import Icon from "./Icon";

type Props = {
  age: number;
  playing: boolean;
  rate: number;
  curves: boolean;
  climate: Climate | null;
  onAge: (age: number) => void;
  onChapter: (chapter: Chapter) => void;
  onPlay: () => void;
  onRate: (rate: number) => void;
};

function ClimateCurves({ climate, age }: { climate: Climate; age: number }) {
  const series = [
    {
      key: "gmst" as const,
      label: "Temperature",
      unit: "°C",
      color: "#e5a078",
    },
    { key: "co2_proxy" as const, label: "CO₂", unit: "ppm", color: "#a6bf8c" },
    {
      key: "sea_level" as const,
      label: "Sea level",
      unit: "m",
      color: "#7fa7cd",
    },
  ];
  return (
    <div className="climate-curves" aria-label="Paleoclimate curves">
      {series.map(({ key, label, unit, color }) => {
        const points = climate[key].points;
        const values = points.map((point) => point[1]);
        const min = Math.min(...values),
          max = Math.max(...values);
        const d = [...points]
          .reverse()
          .map(
            ([age, value], i) =>
              `${i ? "L" : "M"}${(ageToPosition(age) * 1000).toFixed(2)},${(48 - ((value - min) / (max - min)) * 38).toFixed(2)}`,
          )
          .join(" ");
        const value = sample(climate[key], age);
        return (
          <div className="curve" key={key}>
            <span style={{ color }}>
              {label}{" "}
              <b>
                {value === null
                  ? "No data"
                  : `${Math.round(value).toLocaleString()} ${unit}`}
              </b>
            </span>
            <svg
              viewBox="0 0 1000 55"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={d}
                stroke={color}
                fill="none"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={ageToPosition(age) * 1000}
                x2={ageToPosition(age) * 1000}
                y1="0"
                y2="55"
                stroke="#d8b36a"
                opacity=".5"
              />
            </svg>
          </div>
        );
      })}
      <small>
        Published reconstructions · gaps mean unavailable data, not zero
      </small>
    </div>
  );
}

export default function Timeline(props: Props) {
  const {
    age,
    playing,
    rate,
    curves,
    climate,
    onAge,
    onChapter,
    onPlay,
    onRate,
  } = props;
  const dragging = useRef(false);
  const detailBounds = useRef([0, 2.58]);
  const [frozenBounds, setFrozenBounds] = useState<number[] | null>(null);
  const span = Math.max(1.5, age * 0.26);
  const youngest = frozenBounds?.[0] ?? Math.max(0, age - span);
  const oldest =
    frozenBounds?.[1] ?? Math.min(4567, Math.max(2.58, age + span));
  const position = ageToPosition(age) * 100;
  function fromEvent(event: PointerEvent<HTMLDivElement>, detail: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    const bounds = detailBounds.current;
    return detail ? bounds[1] - x * (bounds[1] - bounds[0]) : positionToAge(x);
  }
  function startDrag(event: PointerEvent<HTMLDivElement>, detail: boolean) {
    if (event.button !== 0) return;
    dragging.current = true;
    detailBounds.current = [youngest, oldest];
    if (detail) setFrozenBounds([youngest, oldest]);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onAge(fromEvent(event, detail));
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>, detail: boolean) {
    if (dragging.current) onAge(fromEvent(event, detail));
  }
  function endDrag(event: PointerEvent<HTMLDivElement>, detail: boolean) {
    if (!dragging.current) return;
    dragging.current = false;
    setFrozenBounds(null);
    const value = fromEvent(event, detail);
    onAge(value);
    const rect = event.currentTarget.getBoundingClientRect();
    const closest = [...chapters].sort(
      (a, b) => Math.abs(a.age - value) - Math.abs(b.age - value),
    )[0];
    const distance = detail
      ? (Math.abs(closest.age - value) /
          (detailBounds.current[1] - detailBounds.current[0])) *
        rect.width
      : Math.abs(ageToPosition(closest.age) - ageToPosition(value)) *
        rect.width;
    if (distance < 7) onChapter(closest);
  }
  return (
    <footer className={`timeline ${curves ? "with-curves" : ""}`}>
      <div className="timeline-controls">
        <button
          className="play-button"
          onClick={onPlay}
          aria-label={playing ? "Pause playback" : "Play forward"}
          aria-pressed={playing}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <select
          aria-label="Playback rate"
          value={rate}
          onChange={(event) => onRate(Number(event.target.value))}
        >
          {[2, 5, 10, 25, 60, 150].map((speed) => (
            <option value={speed} key={speed}>
              {speed} Myr/s
            </option>
          ))}
        </select>
      </div>
      <div className="timeline-tracks">
        {curves && climate && <ClimateCurves climate={climate} age={age} />}
        <div
          className="detail-track"
          onPointerDown={(event) => startDrag(event, true)}
          onPointerMove={(event) => moveDrag(event, true)}
          onPointerUp={(event) => endDrag(event, true)}
          onPointerCancel={() => {
            dragging.current = false;
            setFrozenBounds(null);
          }}
          aria-label="Fine geological timeline"
        >
          {periods
            .filter(
              (period) => period.start >= youngest && period.end <= oldest,
            )
            .map((period) => {
              const start = Math.min(oldest, period.start),
                end = Math.max(youngest, period.end);
              return (
                <div
                  className="detail-period"
                  key={period.name}
                  style={{
                    left: `${((oldest - start) / (oldest - youngest)) * 100}%`,
                    width: `${((start - end) / (oldest - youngest)) * 100}%`,
                    background: period.color,
                  }}
                >
                  {period.name}
                </div>
              );
            })}
          {chapters
            .filter(
              (chapter) => chapter.age <= oldest && chapter.age >= youngest,
            )
            .map((chapter) => (
              <button
                key={chapter.id}
                className="detail-marker"
                title={chapter.title}
                aria-label={`Open chapter: ${chapter.title}`}
                style={{
                  left: `${((oldest - chapter.age) / (oldest - youngest)) * 100}%`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onChapter(chapter)}
              />
            ))}
          <div
            className="detail-cursor"
            style={{ left: `${((oldest - age) / (oldest - youngest)) * 100}%` }}
          />
        </div>
        <div className="detail-labels">
          <span>{formatAge(oldest)}</span>
          <span>
            Drag to explore · Ma = million years ago · Ga = billion years ago
          </span>
          <span>{formatAge(youngest)}</span>
        </div>
        <div
          className="deep-track"
          role="slider"
          aria-label="Geological age"
          aria-valuemin={0}
          aria-valuemax={4567}
          aria-valuenow={Number(age.toFixed(3))}
          aria-valuetext={`${formatAge(age)}, ${periods.find((period) => age >= period.end && age <= period.start)?.name}`}
          tabIndex={0}
          onPointerDown={(event) => startDrag(event, false)}
          onPointerMove={(event) => moveDrag(event, false)}
          onPointerUp={(event) => endDrag(event, false)}
          onPointerCancel={() => {
            dragging.current = false;
            setFrozenBounds(null);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey
              ? 100
              : age < 1
                ? 0.01
                : age < 10
                  ? 1
                  : 10;
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              onAge(
                event.key === "Home"
                  ? 4567
                  : event.key === "End"
                    ? 0
                    : age + (event.key === "ArrowLeft" ? step : -step),
              );
            }
          }}
        >
          <div className="era-labels">
            {[
              ["Precambrian", 4567, 541],
              ["Paleozoic", 541, 252],
              ["Mesozoic", 252, 66],
              ["Cenozoic", 66, 0],
            ].map(([label, start, end]) => (
              <span
                key={label}
                style={{
                  left: `${ageToPosition(Number(start)) * 100}%`,
                  width: `${(ageToPosition(Number(end)) - ageToPosition(Number(start))) * 100}%`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="periods">
            {periods.map((period) => (
              <div
                className="period"
                key={period.name}
                title={`${period.name}: ${period.start}–${period.end} Ma`}
                style={{
                  left: `${ageToPosition(period.start) * 100}%`,
                  width: `${(ageToPosition(period.end) - ageToPosition(period.start)) * 100}%`,
                  background: period.color,
                }}
              >
                <span>
                  {period.name
                    .replace("proterozoic", "prot.")
                    .replace("Carboniferous", "Carbonif.")}
                </span>
              </div>
            ))}
          </div>
          <div className="chapter-markers">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                className="chapter-marker"
                style={{ left: `${ageToPosition(chapter.age) * 100}%` }}
                title={`${chapter.title} · ${formatAge(chapter.age)}`}
                aria-label={`Chapter: ${chapter.title}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onChapter(chapter)}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="time-cursor" style={{ left: `${position}%` }}>
            <span />
          </div>
        </div>
      </div>
    </footer>
  );
}
