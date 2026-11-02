import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ageToPosition,
  positionToAge,
  findPlate,
  pointInRing,
  reconstruct,
  sample,
  searchCities,
  type City,
  type Rotations,
} from "../src/lib/earth";

test("nonlinear timeline round-trips the full range including boundary ages", () => {
  let previous = 1;
  for (let age = 0; age <= 4567; age += 0.73) {
    const position = ageToPosition(age);
    assert.ok(position <= previous);
    assert.ok(Math.abs(positionToAge(position) - age) < 1e-8);
    previous = position;
  }
  for (const age of [0, 0.021, 66, 252, 541, 1000, 2500, 4000, 4567]) {
    assert.ok(Math.abs(positionToAge(ageToPosition(age)) - age) < 1e-8);
  }
  assert.equal(positionToAge(-1), 4567);
  assert.equal(positionToAge(2), 0);
});

test("climate interpolation preserves missing coverage instead of extrapolating", () => {
  const series = {
    source: "test",
    points: [
      [10, 20],
      [20, 40],
      [30, 30],
    ],
  };
  assert.equal(sample(series, 15), 30);
  assert.equal(sample(series, 10), 20);
  assert.equal(sample(series, 30), 30);
  assert.equal(sample(series, 0), null);
  assert.equal(sample(series, 100), null);
  assert.equal(sample(undefined, 20), null);
});

test("finite rotations interpolate on the sphere and compose a plate circuit", () => {
  const rotations: Rotations = {
    sequences: {
      "1": [
        [0, 90, 0, 0, 0],
        [100, 90, 0, 90, 0],
      ],
      "2": [
        [0, 90, 0, 0, 1],
        [100, 90, 0, 90, 1],
      ],
    },
  };
  const point = { lat: 0, lon: 0 };
  assert.deepEqual(reconstruct(point, 1, 0, rotations), point);
  const halfway = reconstruct(point, 1, 50, rotations)!;
  assert.ok(Math.abs(halfway.lon - 45) < 1e-8);
  const composed = reconstruct(point, 2, 50, rotations)!;
  assert.ok(Math.abs(composed.lon - 90) < 1e-8);
  assert.equal(reconstruct(point, 1, 200, rotations), null);
  assert.equal(reconstruct(point, null, 50, rotations), null);
  assert.equal(reconstruct(point, 1, 1200, rotations), null);
});

test("rotation circuits reject cycles and reference-plate discontinuities", () => {
  const cyclic: Rotations = {
    sequences: {
      "1": [
        [0, 90, 0, 0, 2],
        [100, 90, 0, 90, 2],
      ],
      "2": [
        [0, 90, 0, 0, 1],
        [100, 90, 0, 90, 1],
      ],
    },
  };
  assert.equal(reconstruct({ lat: 0, lon: 0 }, 1, 50, cyclic), null);
  const discontinuous: Rotations = {
    sequences: {
      "1": [
        [0, 90, 0, 0, 0],
        [100, 90, 0, 90, 2],
      ],
    },
  };
  assert.equal(reconstruct({ lat: 0, lon: 0 }, 1, 50, discontinuous), null);
});

test("plate lookup excludes polygon holes and expired features", () => {
  const ring = [
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
    [-10, -10],
  ];
  assert.equal(pointInRing({ lat: 0, lon: 0 }, ring), true);
  assert.equal(pointInRing({ lat: 30, lon: 0 }, ring), false);
  const plate = { pid: 1, begin: 100, end: 0, rings: [ring], holes: [] };
  assert.equal(findPlate({ lat: 0, lon: 0 }, [plate]), 1);
  assert.equal(findPlate({ lat: 0, lon: 0 }, [{ ...plate, end: 10 }]), null);
  assert.equal(
    findPlate({ lat: 0, lon: 0 }, [{ ...plate, holes: [ring] }]),
    null,
  );
});

test("real local plate data reconstruct London without losing a valid circuit", () => {
  const rotations = JSON.parse(
    readFileSync("public/data/rotations.json", "utf8"),
  );
  const plates = JSON.parse(
    readFileSync("public/data/plates.json", "utf8"),
  ).features;
  const london = { lat: 51.508, lon: -0.126 };
  const pid = findPlate(london, plates);
  assert.notEqual(pid, null);
  const ancient = reconstruct(london, pid, 400, rotations);
  assert.ok(ancient);
  assert.ok(ancient.lat < london.lat - 10);
  assert.ok(Number.isFinite(ancient.lon));
});

test("plate lookup handles antimeridian polygons without including Greenwich", () => {
  const ring = [
    [170, -10],
    [-170, -10],
    [-170, 10],
    [170, 10],
    [170, -10],
  ];
  assert.equal(pointInRing({ lat: 0, lon: 179 }, ring), true);
  assert.equal(pointInRing({ lat: 0, lon: -179 }, ring), true);
  assert.equal(pointInRing({ lat: 0, lon: 0 }, ring), false);
  assert.equal(pointInRing({ lat: 20, lon: 179 }, ring), false);
});

test("city matching handles accents and prioritizes prefixes", () => {
  const cities: City[] = [
    {
      name: "São Paulo",
      aliases: "Sao Paulo",
      country: "Brazil",
      lat: -23,
      lon: -46,
    },
    {
      name: "East London",
      aliases: "",
      country: "South Africa",
      lat: -33,
      lon: 27,
    },
    { name: "London", aliases: "", country: "United Kingdom", lat: 51, lon: 0 },
  ];
  assert.equal(searchCities(cities, "sao")[0].name, "São Paulo");
  assert.equal(searchCities(cities, "london")[0].name, "London");
  assert.deepEqual(searchCities(cities, "   "), []);
  assert.deepEqual(searchCities(cities, "no-such-place"), []);
});
