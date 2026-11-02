"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chapters, type Chapter } from "@/lib/chapters";
import {
  asset,
  clampAge,
  coordinates,
  findPlate,
  formatAge,
  periodAt,
  reconstruct,
  sample,
  searchCities,
  type City,
  type Climate,
  type Coordinate,
  type Fossil,
  type Layers,
  type Plate,
  type Rotations,
} from "@/lib/earth";
import Globe from "./Globe";
import Icon from "./Icon";
import Timeline from "./Timeline";
import ChapterScene from "./ChapterScene";

type Dataset = {
  climate: Climate | null;
  cities: City[];
  plates: Plate[];
  rotations: Rotations | null;
  fossils: Fossil[];
};
const emptyData: Dataset = {
  climate: null,
  cities: [],
  plates: [],
  rotations: null,
  fossils: [],
};
const layerOptions = [
  {
    key: "fossils" as const,
    title: "Fossil occurrences",
    description:
      "Sampled Paleobiology Database records, reconstructed to this age",
  },
  {
    key: "curves" as const,
    title: "Paleoclimate curves",
    description: "Temperature, CO₂ and sea level along the timeline",
  },
  {
    key: "ice" as const,
    title: "Ice extent",
    description: "Illustrative latitude-based ice cover, not a local ice map",
  },
  {
    key: "coastlines" as const,
    title: "Modern coastlines",
    description: "A ghost reference of today's shores",
  },
];

export default function Experience() {
  const [age, setAge] = useState(0);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Dataset>(emptyData);
  const [dataError, setDataError] = useState(false);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [popover, setPopover] = useState<"city" | "layers" | null>(null);
  const [sources, setSources] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<City | null>(null);
  const [focus, setFocus] = useState<Coordinate | null>(null);
  const [layers, setLayers] = useState<Layers>({
    fossils: false,
    curves: false,
    ice: true,
    coastlines: false,
  });
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(10);
  const [sound, setSound] = useState(false);
  const [toast, setToast] = useState("");
  const [tooltip, setTooltip] = useState<{
    fossil: Fossil;
    x: number;
    y: number;
  } | null>(null);
  const [hint, setHint] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const cityInput = useRef<HTMLInputElement>(null);
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const shareInput = useRef<HTMLInputElement>(null);
  const [shareFallback, setShareFallback] = useState("");
  const onReady = useCallback(() => setReady(true), []);
  const onFossil = useCallback(
    (fossil: Fossil | null, x: number, y: number) => {
      setTooltip(fossil ? { fossil, x, y } : null);
    },
    [],
  );

  useEffect(() => {
    const abort = new AbortController();
    const read = async (path: string) => {
      const response = await fetch(asset(`/data/${path}.json`), {
        signal: abort.signal,
      });
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return response.json();
    };
    Promise.all([
      read("climate"),
      read("cities"),
      read("plates"),
      read("rotations"),
      read("fossils"),
    ])
      .then(([climate, cities, plates, rotations, fossils]) => {
        setData({
          climate,
          cities,
          plates: plates.features,
          rotations,
          fossils,
        });
        const parameters = new URLSearchParams(location.search);
        const requestedAge = parameters.get("age");
        const requestedChapter = chapters.find(
          (item) => item.id === parameters.get("chapter"),
        );
        const restoredAge = clampAge(
          requestedAge === null
            ? (requestedChapter?.age ?? 0)
            : Number(requestedAge),
        );
        setAge(restoredAge);
        const enabledLayers = parameters.get("layers");
        if (enabledLayers !== null) {
          const enabled = new Set(enabledLayers.split(","));
          setLayers({
            fossils: enabled.has("fossils"),
            curves: enabled.has("curves"),
            ice: enabled.has("ice"),
            coastlines: enabled.has("coastlines"),
          });
        }
        if (requestedChapter) setChapter(requestedChapter);
        const requestedCity = cities.find(
          (item: City) =>
            item.name === parameters.get("city") &&
            (!parameters.get("country") ||
              item.country === parameters.get("country")),
        );
        if (requestedCity) {
          setCity(requestedCity);
          setQuery(requestedCity.name);
          setPopover("city");
          const point = reconstruct(
            requestedCity,
            findPlate(requestedCity, plates.features),
            restoredAge,
            rotations,
          );
          if (point) setFocus(point);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDataError(true);
      });
    const timeout = setTimeout(() => setReady(true), 15000);
    return () => {
      abort.abort();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (sources) dialog.current?.showModal();
    else dialog.current?.close();
  }, [sources]);
  useEffect(() => {
    if (popover === "city") cityInput.current?.focus();
  }, [popover]);
  useEffect(() => {
    if (shareFallback) shareInput.current?.select();
  }, [shareFallback]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPopover(null);
        setChapter(null);
        setShareFallback("");
      }
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLButtonElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        !dialog.current?.open
      ) {
        event.preventDefault();
        setPlaying((previous) => !previous);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = 0;
    const tick = (time: number) => {
      if (previous) {
        const delta = Math.min((time - previous) / 1000, 0.2);
        setAge((current) => Math.max(0, current - delta * rate));
      }
      previous = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate]);
  useEffect(() => {
    if (age === 0 && playing) {
      const task = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(task);
    }
  }, [age, playing]);
  useEffect(
    () => () => {
      void audio.current?.context.close();
    },
    [],
  );
  useEffect(() => {
    const listener = () => {
      if (audio.current) {
        if (document.hidden) void audio.current.context.suspend();
        else if (sound) void audio.current.context.resume();
      }
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, [sound]);

  const period = periodAt(age);
  const cityPlate = useMemo(
    () => (city ? findPlate(city, data.plates) : null),
    [city, data.plates],
  );
  const cityPosition = useMemo(
    () =>
      city && data.rotations
        ? reconstruct(city, cityPlate, age, data.rotations)
        : null,
    [city, cityPlate, age, data.rotations],
  );
  const suggestions = useMemo(
    () => searchCities(data.cities, query),
    [data.cities, query],
  );
  const temperature = sample(data.climate?.gmst, age);
  const oxygen = sample(data.climate?.o2_model, age);
  const co2 =
    age === 0
      ? null
      : (sample(data.climate?.co2_proxy, age) ??
        sample(data.climate?.co2_model, age));
  const seaLevel = sample(data.climate?.sea_level, age);
  let iceLatitude = sample(data.climate?.ice_lat, age) ?? 80;
  if (age > 635 && age < 720) iceLatitude = 12;
  if (age > 2200 && age < 2450) iceLatitude = 35;
  if (age > 4000) iceLatitude = 90;
  if (age > 0.015 && age < 0.03) iceLatitude = 48;
  const confidence =
    age <= 540
      ? "Published paleoelevation"
      : age <= 1100
        ? "Plate model · lower confidence"
        : "Interpretive geography";

  const changeAge = (value: number) => {
    setAge(clampAge(value));
    setPlaying(false);
    setHint(false);
    setTooltip(null);
  };
  const openChapter = (value: Chapter) => {
    changeAge(value.age);
    setChapter(value);
    setPopover(null);
  };
  const chooseCity = (value: City) => {
    setCity(value);
    setQuery(value.name);
    const point = data.rotations
      ? reconstruct(value, findPlate(value, data.plates), age, data.rotations)
      : value;
    if (point) setFocus(point);
  };
  const toggleSound = async () => {
    if (sound) {
      if (audio.current)
        audio.current.gain.gain.setTargetAtTime(
          0,
          audio.current.context.currentTime,
          0.2,
        );
      setSound(false);
      return;
    }
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(context.destination);
        [55, 82.4, 110.2].forEach((frequency) => {
          const oscillator = context.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          oscillator.start();
        });
        audio.current = { context, gain };
      }
      await audio.current.context.resume();
      audio.current.gain.gain.setTargetAtTime(
        0.026,
        audio.current.context.currentTime,
        0.6,
      );
      setSound(true);
    } catch {
      setToast("Audio is unavailable in this browser.");
    }
  };
  const share = async () => {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("age", age.toFixed(3));
    url.searchParams.set(
      "layers",
      Object.entries(layers)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .join(","),
    );
    if (chapter) url.searchParams.set("chapter", chapter.id);
    if (city) {
      url.searchParams.set("city", city.name);
      url.searchParams.set("country", city.country);
    }
    try {
      await navigator.clipboard.writeText(url.href);
      setToast("Link copied to clipboard");
      history.replaceState(null, "", url);
    } catch {
      setShareFallback(url.href);
    }
  };
  const chapterIndex = chapter ? chapters.indexOf(chapter) : -1;
  const evidence = [
    {
      label: "Temperature",
      value:
        temperature === null ? "Unconstrained" : `${temperature.toFixed(1)} °C`,
      note: "Global mean · paleoclimate model",
    },
    {
      label: "Carbon dioxide",
      value:
        co2 === null
          ? age === 0
            ? "Modern atmosphere"
            : "Unconstrained"
          : `${Math.round(co2).toLocaleString()} ppm`,
      note:
        age === 0
          ? "Live observations not included"
          : "Proxy median or model estimate",
    },
    {
      label: "Oxygen",
      value:
        oxygen === null
          ? "Unconstrained"
          : oxygen < 0.01
            ? "< 0.01%"
            : `${oxygen.toFixed(1)}%`,
      note: "Atmospheric fraction · model",
    },
    {
      label: "Sea level",
      value:
        seaLevel === null
          ? "Unconstrained"
          : `${seaLevel >= 0 ? "+" : ""}${Math.round(seaLevel)} m`,
      note: "Relative to the modern baseline",
    },
  ];

  return (
    <main
      className={`experience ${layers.curves ? "curves-open" : ""} ${chapter ? "chapter-open" : ""}`}
    >
      <Globe
        age={age}
        layers={layers}
        iceLatitude={iceLatitude}
        plates={data.plates}
        rotations={data.rotations}
        fossils={data.fossils}
        pin={cityPosition}
        focus={playing && cityPosition ? cityPosition : focus}
        onReady={onReady}
        onFossil={onFossil}
      />
      {!ready && (
        <div className="loader" role="status">
          <div>
            <h1>Earth Through Deep Time</h1>
            <div className="loading-line" />
            <p>Preparing a planet. Opening deep time…</p>
          </div>
        </div>
      )}
      <header className="masthead">
        <h1>Earth Through Deep Time</h1>
        <nav className="toolbar" aria-label="Controls">
          <button
            className="tool-button"
            title="Where was my city?"
            aria-label="Where was my city?"
            aria-expanded={popover === "city"}
            onClick={() => setPopover(popover === "city" ? null : "city")}
          >
            <Icon name="pin" />
            <span>Where was my city?</span>
          </button>
          <button
            className="tool-button"
            title="Layers"
            aria-label="Layers"
            aria-expanded={popover === "layers"}
            onClick={() => setPopover(popover === "layers" ? null : "layers")}
          >
            <Icon name="layers" />
            <span>Layers</span>
          </button>
          <button
            className="tool-button"
            title="Sources and method"
            aria-label="Sources and method"
            onClick={() => setSources(true)}
          >
            <Icon name="sources" />
            <span>Sources</span>
          </button>
          <button
            className="tool-button"
            title="Copy a link to this view"
            aria-label="Share this view"
            onClick={share}
          >
            <Icon name="share" />
            <span>Share</span>
          </button>
          <button
            className="tool-button icon-only"
            title={sound ? "Mute sound" : "Enable ambient sound"}
            aria-label={sound ? "Mute sound" : "Enable ambient sound"}
            aria-pressed={sound}
            onClick={toggleSound}
          >
            <Icon name={sound ? "sound" : "muted"} />
          </button>
        </nav>
      </header>
      {dataError && (
        <div className="data-error" role="alert">
          Some scientific data could not load.{" "}
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      )}
      <div className="age-readout" aria-live={playing ? "off" : "polite"}>
        <div className="age-value" data-testid="age">
          {formatAge(age)}
        </div>
        <div className="age-subtitle">
          {age === 0 ? "Holocene · " : ""}
          {period.name} · {period.era}
        </div>
        {age > 0 && (
          <span
            className={`confidence ${age > 1100 ? "interpretive" : age > 540 ? "medium" : ""}`}
          >
            <i />
            {confidence}
          </span>
        )}
      </div>
      {hint && (
        <div className="hint">
          Drag the timeline to go back in time. Release on a marker to open a
          chapter.
        </div>
      )}
      {cityPosition && city && (
        <div className="selected-place">
          <Icon name="pin" />
          <b>{city.name}</b>
          <span>{coordinates(cityPosition)}</span>
        </div>
      )}

      {popover === "city" && (
        <section
          className="city-card glass-card"
          aria-label="Find your city in deep time"
        >
          <div className="card-heading">
            <input
              ref={cityInput}
              type="search"
              placeholder="Type a city or place…"
              aria-label="Search a place"
              value={query}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setCity(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && suggestions[0] && !city)
                  chooseCity(suggestions[0]);
              }}
            />
            <button
              className="round-button"
              onClick={() => setPopover(null)}
              aria-label="Close city search"
            >
              <Icon name="close" />
            </button>
          </div>
          {!city && query.trim() && (
            <ul className="suggestions" aria-label="City suggestions">
              {suggestions.map((item, index) => (
                <li key={`${item.name}-${item.country}-${index}`}>
                  <button onClick={() => chooseCity(item)}>
                    <span>{item.name}</span>
                    <small>{item.country}</small>
                  </button>
                </li>
              ))}
              {!suggestions.length && (
                <li className="no-results">
                  {data.cities.length
                    ? "No matching city. Try a nearby larger city."
                    : "Loading city index…"}
                </li>
              )}
            </ul>
          )}
          {!query && (
            <p className="muted small">
              Find where the ground beneath your city was millions of years ago.
              Search over 15,000 populated places, offline.
            </p>
          )}
          {city && (
            <div className="city-result">
              <h2>{city.name}</h2>
              <p className="muted small">
                {city.country} · today: {coordinates(city)}
              </p>
              <p>
                At <b className="gold">{formatAge(age)}</b>:{" "}
                {cityPosition
                  ? coordinates(cityPosition)
                  : "outside the supported reconstruction"}
              </p>
              <div className="city-milestones">
                {[100, 200, 400].map((time) => {
                  const point = data.rotations
                    ? reconstruct(city, cityPlate, time, data.rotations)
                    : null;
                  return (
                    <button
                      key={time}
                      onClick={() => {
                        changeAge(time);
                        if (point) setFocus(point);
                      }}
                    >
                      <b>{time} Ma</b>
                      <span>
                        {point
                          ? `${Math.abs(point.lat).toFixed(0)}° ${point.lat >= 0 ? "N" : "S"}`
                          : "No model"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="muted small">
                {cityPlate
                  ? `Plate ${cityPlate}. Position from the PALEOMAP rotation model; it does not establish whether the site was above sea level.`
                  : "No containing plate found. Historical coordinates are unavailable."}
              </p>
              <button
                className="text-button"
                disabled={!cityPlate}
                onClick={() => {
                  changeAge(400);
                  setPlaying(true);
                }}
              >
                Trace back from 400 Ma
              </button>
            </div>
          )}
        </section>
      )}

      {popover === "layers" && (
        <section className="layer-card glass-card" aria-label="Map layers">
          <div className="card-heading">
            <span className="eyebrow">Explore the evidence</span>
            <button
              className="round-button"
              onClick={() => setPopover(null)}
              aria-label="Close layers"
            >
              <Icon name="close" />
            </button>
          </div>
          {layerOptions.map(({ key, title, description }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(event) => {
                  setLayers({ ...layers, [key]: event.target.checked });
                  setHint(false);
                }}
              />
              <span>
                {title}
                <small>{description}</small>
              </span>
            </label>
          ))}
          {layers.fossils && (
            <p className="muted small">
              {
                data.fossils.filter(
                  (fossil) => age >= fossil.min && age <= fossil.max,
                ).length
              }{" "}
              sampled records overlap this age. Hover over gold points to
              inspect.
            </p>
          )}
        </section>
      )}

      {chapter && (
        <aside
          className="chapter-panel glass-card"
          aria-label="Earth history chapter"
          key={chapter.id}
        >
          <div className="panel-navigation">
            <button
              className="round-button"
              aria-label="Previous chapter"
              disabled={chapterIndex === 0}
              onClick={() => openChapter(chapters[chapterIndex - 1])}
            >
              <Icon name="previous" />
            </button>
            <span className="eyebrow">
              {String(chapterIndex + 1).padStart(2, "0")} / {chapters.length}{" "}
              chapters
            </span>
            <button
              className="round-button"
              aria-label="Next chapter"
              disabled={chapterIndex === chapters.length - 1}
              onClick={() => openChapter(chapters[chapterIndex + 1])}
            >
              <Icon name="next" />
            </button>
            <button
              className="round-button"
              aria-label="Close chapter"
              onClick={() => setChapter(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <h2>{chapter.title}</h2>
          <p className="chapter-subtitle">{chapter.subtitle}</p>
          {Math.abs(age - chapter.age) > Math.max(0.01, chapter.age * 0.01) && (
            <p className="chapter-age-note">
              Chapter anchored at {formatAge(chapter.age)}. Globe and evidence
              show {formatAge(age)}.{" "}
              <button
                className="text-button"
                onClick={() => changeAge(chapter.age)}
              >
                Return
              </button>
            </p>
          )}
          <ChapterScene chapter={chapter} />
          <div className="evidence-grid">
            {evidence.map((item) => (
              <div key={item.label}>
                <span className="eyebrow">{item.label}</span>
                <b>{item.value}</b>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
          <h3>Dominant life</h3>
          <p>{chapter.life}</p>
          <h3>Defining events</h3>
          <ul>
            {chapter.events.map((event) => (
              <li key={event}>{event}</li>
            ))}
          </ul>
          <h3>Sources</h3>
          <a href={chapter.url} target="_blank" rel="noreferrer">
            {chapter.source} ↗
          </a>
          <p className="muted small">
            Illustration is artistic. Evidence values are estimates for the
            selected globe age, not precise observations.
          </p>
        </aside>
      )}
      {tooltip && layers.fossils && (
        <div
          className="fossil-tooltip glass-card"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 260),
            top: Math.min(tooltip.y + 14, window.innerHeight - 130),
          }}
        >
          <b>{tooltip.fossil.name}</b>
          <span>
            {tooltip.fossil.max}–{tooltip.fossil.min} Ma
          </span>
          <a
            href={`https://paleobiodb.org/classic/basicOccurrenceSearch?occurrence_no=${tooltip.fossil.id}`}
            target="_blank"
            rel="noreferrer"
          >
            PBDB occurrence #{tooltip.fossil.id} ↗
          </a>
        </div>
      )}

      <Timeline
        age={age}
        playing={playing}
        rate={rate}
        curves={layers.curves}
        climate={data.climate}
        onAge={changeAge}
        onChapter={openChapter}
        onPlay={() => {
          if (age === 0 && !playing) setAge(4567);
          setPlaying(!playing);
          setHint(false);
        }}
        onRate={setRate}
      />

      <dialog
        ref={dialog}
        className="sources-dialog"
        aria-labelledby="sources-title"
        onCancel={() => setSources(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSources(false);
        }}
      >
        <div className="modal-content">
          <button
            className="round-button modal-close"
            aria-label="Close sources"
            onClick={() => setSources(false)}
          >
            <Icon name="close" />
          </button>
          <span className="eyebrow gold">A field guide to the planet</span>
          <h2 id="sources-title">Sources and method</h2>
          <p>
            This independent, open-source recreation of{" "}
            <a
              href="https://deeptime.pplx.app/"
              target="_blank"
              rel="noreferrer"
            >
              deeptime.pplx.app
            </a>{" "}
            is built with Next.js, React, TypeScript, and Three.js. All
            application code, chapter writing, procedural sound, and landscape
            illustrations are newly authored.
          </p>
          <h3>The moving Earth</h3>
          <p>
            From 0 to 540 Ma, the globe uses 109 local, colorized PALEOMAP
            paleoelevation maps at 5-million-year spacing. Maps switch to the
            nearest frame; they do not represent a continuous tectonic
            simulation. Between 540 and 1,100 Ma, rotated plate polygons provide
            a lower-confidence continental outline. Earlier geography is
            explicitly artistic, not a reconstruction.
          </p>
          <ul>
            <li>
              <a
                href="https://doi.org/10.5281/zenodo.5460860"
                target="_blank"
                rel="noreferrer"
              >
                Scotese & Wright (2018), PALEOMAP PaleoDEMs
              </a>{" "}
              · CC BY 4.0. Colors and textures adapted here.
            </li>
            <li>
              <a
                href="https://www.earthbyte.org/paleomap-paleoatlas-for-gplates/"
                target="_blank"
                rel="noreferrer"
              >
                Scotese PALEOMAP plate model
              </a>{" "}
              · factual polygon and rotation tables, via the published reference
              data conversion.
            </li>
            <li>
              <a
                href="https://visibleearth.nasa.gov/collection/1484/blue-marble"
                target="_blank"
                rel="noreferrer"
              >
                NASA Visible Earth, Blue Marble
              </a>{" "}
              · modern Earth image; NASA imagery usage guidelines apply. No NASA
              endorsement is implied.
            </li>
            <li>
              <a
                href="https://www.naturalearthdata.com/about/terms-of-use/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth
              </a>{" "}
              · public-domain modern coastlines.
            </li>
          </ul>
          <h3>Atmosphere, climate, and life</h3>
          <ul>
            <li>
              <a
                href="https://doi.org/10.1016/j.earscirev.2021.103503"
                target="_blank"
                rel="noreferrer"
              >
                Scotese et al. (2021)
              </a>{" "}
              · modeled global mean temperature, CC BY 4.0.
            </li>
            <li>
              <a
                href="https://doi.org/10.1016/j.gr.2022.07.014"
                target="_blank"
                rel="noreferrer"
              >
                van der Meer et al. (2022)
              </a>{" "}
              · sea level and indicative ice latitude, CC BY 4.0.
            </li>
            <li>
              <a
                href="https://zenodo.org/records/18236760"
                target="_blank"
                rel="noreferrer"
              >
                Paleo-CO₂ Data Archive
              </a>{" "}
              · proxy medians, CC BY 4.0. Older values use published
              order-of-magnitude models.
            </li>
            <li>
              <a
                href="https://doi.org/10.1038/s41467-018-06383-y"
                target="_blank"
                rel="noreferrer"
              >
                Krause et al. (2018)
              </a>
              , Berner (2009), and Lyons et al. (2014) · modeled oxygen, not
              direct measurements.
            </li>
            <li>
              <a
                href="https://paleobiodb.org/"
                target="_blank"
                rel="noreferrer"
              >
                Paleobiology Database
              </a>{" "}
              · {data.fossils.length.toLocaleString()} sampled occurrence
              records, CC BY 4.0; this is not the complete fossil record.
              Fossils are plotted only when a plate reconstruction is available.
            </li>
            <li>
              <a
                href="https://www.geonames.org/"
                target="_blank"
                rel="noreferrer"
              >
                GeoNames
              </a>{" "}
              · {data.cities.length.toLocaleString()} cities, CC BY 4.0. City
              locations are back-rotated with their containing plate; they are
              not historical settlements.
            </li>
          </ul>
          <h3>Reading the evidence</h3>
          <p>
            Ma means million years ago; Ga means billion years ago; ka means
            thousand years ago. The full-history timeline deliberately uses a
            nonlinear scale to make recent periods readable. The upper timeline
            gives finer control around the current age. Climate lines stop where
            data are unavailable; “unconstrained” is not zero. Ice is a
            latitude-based visualization, not a mapped reconstruction. The Last
            Glacial Maximum ice limit is an illustrative override.
          </p>
          <h3>Local assets and licensing</h3>
          <p>
            Imagery, maps, fonts, city coordinates, fossil records, coastlines,
            and climate tables are bundled locally. Cormorant Garamond is
            distributed under the SIL Open Font License. Unknown-license
            reference videos, proprietary code, and editorial prose were not
            redistributed. The complete asset provenance is in the repository{" "}
            <a
              href="https://github.com/huangyingting/deeptime/blob/main/ATTRIBUTION.md"
              target="_blank"
              rel="noreferrer"
            >
              attribution document
            </a>
            .
          </p>
          <h3>Controls</h3>
          <p>
            Drag the globe to rotate and scroll or pinch to zoom. Drag either
            timeline to change age; click a gold marker for a chapter. Focus the
            lower timeline and use arrow keys (Shift for larger steps), Home for
            the formation of Earth, or End for today. Space toggles playback.
            Escape closes panels.
          </p>
        </div>
      </dialog>
      {shareFallback && (
        <div
          className="share-card glass-card"
          role="region"
          aria-label="Copy share link"
        >
          <div className="card-heading">
            <span>Copy a link to this view</span>
            <button
              className="round-button"
              aria-label="Close share link"
              onClick={() => setShareFallback("")}
            >
              <Icon name="close" />
            </button>
          </div>
          <input
            ref={shareInput}
            aria-label="Share link"
            readOnly
            value={shareFallback}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {playing ? "Timeline playing forward" : ""}
      </div>
    </main>
  );
}
