export const MAX_AGE = 4567;
export const asset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;

export type Coordinate = { lat: number; lon: number };
export type City = Coordinate & {
  name: string;
  country: string;
  aliases: string;
};
export type Fossil = Coordinate & {
  id: string;
  name: string;
  min: number;
  max: number;
};
export type Layers = {
  fossils: boolean;
  curves: boolean;
  ice: boolean;
  coastlines: boolean;
};
export type ClimateSeries = { source: string; points: number[][] };
export type Climate = Record<
  "gmst" | "sea_level" | "co2_proxy" | "co2_model" | "o2_model" | "ice_lat",
  ClimateSeries
>;
export type Plate = {
  pid: number;
  begin: number | null;
  end: number | null;
  rings: number[][][];
  holes: number[][][];
};
export type RotationRow = [number, number, number, number, number];
export type Rotations = { sequences: Record<string, RotationRow[]> };
type Quaternion = [number, number, number, number];

const anchors = [
  [0, 1],
  [66, 0.9],
  [252, 0.75],
  [541, 0.51],
  [1000, 0.37],
  [2500, 0.22],
  [4000, 0.065],
  [MAX_AGE, 0],
];

export function clampAge(age: number): number {
  return Number.isFinite(age) ? Math.min(MAX_AGE, Math.max(0, age)) : 0;
}

export function ageToPosition(age: number): number {
  age = clampAge(age);
  const i = anchors.findIndex((point, index) => index > 0 && age <= point[0]);
  const [a, x] = anchors[Math.max(0, i - 1)];
  const [b, y] = anchors[i < 0 ? anchors.length - 1 : i];
  return x + ((age - a) / (b - a)) * (y - x);
}

export function positionToAge(position: number): number {
  const x = Math.min(1, Math.max(0, position));
  const i = anchors.findIndex((point, index) => index > 0 && x >= point[1]);
  const [a, left] = anchors[Math.max(0, i - 1)];
  const [b, right] = anchors[i < 0 ? anchors.length - 1 : i];
  return clampAge(a + ((x - left) / (right - left)) * (b - a));
}

export function formatAge(age: number): string {
  if (age < 0.001) return "Today";
  if (age >= 1000) return `${(age / 1000).toFixed(2).replace(/0$/, "")} Ga`;
  if (age < 1) return `${Math.round(age * 1000)} ka`;
  return `${Number(age.toFixed(1))} Ma`;
}

export const periods = [
  {
    name: "Quaternary",
    start: 2.58,
    end: 0,
    color: "#858473",
    era: "Cenozoic",
  },
  {
    name: "Neogene",
    start: 23.03,
    end: 2.58,
    color: "#aaa568",
    era: "Cenozoic",
  },
  {
    name: "Paleogene",
    start: 66,
    end: 23.03,
    color: "#897361",
    era: "Cenozoic",
  },
  {
    name: "Cretaceous",
    start: 145,
    end: 66,
    color: "#6d7950",
    era: "Mesozoic",
  },
  {
    name: "Jurassic",
    start: 201.4,
    end: 145,
    color: "#456c72",
    era: "Mesozoic",
  },
  {
    name: "Triassic",
    start: 251.9,
    end: 201.4,
    color: "#7d546d",
    era: "Mesozoic",
  },
  {
    name: "Permian",
    start: 298.9,
    end: 251.9,
    color: "#8e5547",
    era: "Paleozoic",
  },
  {
    name: "Carboniferous",
    start: 358.9,
    end: 298.9,
    color: "#52675e",
    era: "Paleozoic",
  },
  {
    name: "Devonian",
    start: 419.2,
    end: 358.9,
    color: "#89754f",
    era: "Paleozoic",
  },
  {
    name: "Silurian",
    start: 443.8,
    end: 419.2,
    color: "#789284",
    era: "Paleozoic",
  },
  {
    name: "Ordovician",
    start: 485.4,
    end: 443.8,
    color: "#376f62",
    era: "Paleozoic",
  },
  {
    name: "Cambrian",
    start: 541,
    end: 485.4,
    color: "#748058",
    era: "Paleozoic",
  },
  {
    name: "Neoproterozoic",
    start: 1000,
    end: 541,
    color: "#725b68",
    era: "Precambrian",
  },
  {
    name: "Mesoproterozoic",
    start: 1600,
    end: 1000,
    color: "#725465",
    era: "Precambrian",
  },
  {
    name: "Paleoproterozoic",
    start: 2500,
    end: 1600,
    color: "#664657",
    era: "Precambrian",
  },
  {
    name: "Archean",
    start: 4000,
    end: 2500,
    color: "#60233d",
    era: "Precambrian",
  },
  {
    name: "Hadean",
    start: MAX_AGE,
    end: 4000,
    color: "#3d1230",
    era: "Precambrian",
  },
];

export function periodAt(age: number) {
  return (
    periods.find((period) => age <= period.start && age >= period.end) ||
    periods[periods.length - 1]
  );
}

export function sample(
  series: ClimateSeries | undefined,
  age: number,
): number | null {
  if (!series?.points.length) return null;
  const points = series.points;
  if (age < points[0][0] || age > points[points.length - 1][0]) return null;
  const right = points.findIndex((point) => point[0] >= age);
  if (right === 0) return points[0][1];
  const [a, value] = points[right - 1];
  const [b, next] = points[right];
  return value + ((age - a) / (b - a)) * (next - value);
}

const unwrappedRings = new WeakMap<number[][], number[][]>();

export function pointInRing(point: Coordinate, ring: number[][]): boolean {
  if (!ring.length) return false;
  let unwrapped = unwrappedRings.get(ring);
  if (!unwrapped) {
    let previous = ring[0][0];
    unwrapped = ring.map(([longitude, latitude]) => {
      // Dateline-crossing edges must take the short way around the planet.
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
      previous = longitude;
      return [longitude, latitude];
    });
    unwrappedRings.set(ring, unwrapped);
  }
  const center =
    (Math.min(...unwrapped.map((p) => p[0])) +
      Math.max(...unwrapped.map((p) => p[0]))) /
    2;
  const longitude = point.lon + 360 * Math.round((center - point.lon) / 360);
  let inside = false;
  for (let i = 0, j = unwrapped.length - 1; i < unwrapped.length; j = i++) {
    const [xi, yi] = unwrapped[i];
    const [xj, yj] = unwrapped[j];
    if (
      yi > point.lat !== yj > point.lat &&
      longitude < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function findPlate(point: Coordinate, plates: Plate[]): number | null {
  const plate = plates.find(
    (plate) =>
      (plate.begin ?? MAX_AGE) >= 0 &&
      (plate.end ?? 0) <= 0 &&
      plate.rings.some((ring) => pointInRing(point, ring)) &&
      !plate.holes.some((ring) => pointInRing(point, ring)),
  );
  return plate?.pid ?? null;
}

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function rowQuaternion(row: RotationRow): Quaternion {
  const lat = (row[1] * Math.PI) / 180;
  const lon = (row[2] * Math.PI) / 180;
  const half = (row[3] * Math.PI) / 360;
  return [
    Math.cos(lat) * Math.cos(lon) * Math.sin(half),
    Math.cos(lat) * Math.sin(lon) * Math.sin(half),
    Math.sin(lat) * Math.sin(half),
    Math.cos(half),
  ];
}

function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  if (dot < 0) {
    b = b.map((value) => -value) as Quaternion;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const result = a.map(
      (value, i) => value + t * (b[i] - value),
    ) as Quaternion;
    const length = Math.hypot(...result);
    return result.map((value) => value / length) as Quaternion;
  }
  const theta = Math.acos(Math.min(1, dot));
  return a.map(
    (value, i) =>
      (value * Math.sin((1 - t) * theta) + b[i] * Math.sin(t * theta)) /
      Math.sin(theta),
  ) as Quaternion;
}

export function plateRotation(
  pid: number,
  age: number,
  rotations: Rotations,
  visited = new Set<number>(),
): Quaternion | null {
  if (pid === 0) return [0, 0, 0, 1];
  if (visited.has(pid)) return null;
  visited.add(pid);
  const sequence = rotations.sequences[pid];
  if (!sequence) return null;
  // Duplicate ages mark a change of reference plate; never interpolate across it.
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = sequence[i],
      b = sequence[i + 1];
    if (age < a[0] || age > b[0] || a[4] !== b[4] || b[0] === a[0]) continue;
    const parent = plateRotation(a[4], age, rotations, visited);
    if (!parent) return null;
    return multiply(
      parent,
      slerp(rowQuaternion(a), rowQuaternion(b), (age - a[0]) / (b[0] - a[0])),
    );
  }
  return null;
}

export function reconstruct(
  point: Coordinate,
  pid: number | null,
  age: number,
  rotations: Rotations,
): Coordinate | null {
  if (age === 0) return point;
  if (pid === null || age > 1100) return null;
  const q = plateRotation(pid, age, rotations);
  if (!q) return null;
  const lat = (point.lat * Math.PI) / 180,
    lon = (point.lon * Math.PI) / 180;
  const v: Quaternion = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    0,
  ];
  const rotated = multiply(multiply(q, v), [-q[0], -q[1], -q[2], q[3]]);
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, rotated[2]))) * 180) / Math.PI,
    lon: (Math.atan2(rotated[1], rotated[0]) * 180) / Math.PI,
  };
}

export function coordinates(point: Coordinate): string {
  return `${Math.abs(point.lat).toFixed(1)}° ${point.lat >= 0 ? "N" : "S"}, ${Math.abs(point.lon).toFixed(1)}° ${point.lon >= 0 ? "E" : "W"}`;
}

export function searchCities(cities: City[], query: string): City[] {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = normalize(query.trim());
  if (!term) return [];
  return cities
    .filter((city) =>
      normalize(`${city.name} ${city.aliases} ${city.country}`).includes(term),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.name).startsWith(term)) -
        Number(normalize(a.name).startsWith(term)),
    )
    .slice(0, 7);
}
