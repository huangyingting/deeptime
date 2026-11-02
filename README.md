# Earth Through Deep Time

A Next.js / TypeScript recreation of the interactive experience at
[deeptime.pplx.app](https://deeptime.pplx.app/), with original implementation,
writing, sound, and landscape illustrations.

**Live:** https://huangyingting.github.io/deeptime/

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No API keys, backend, or external runtime assets are
required.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:browser
```

The browser check serves `out/` itself and uses installed Chrome
(`CHROME_PATH=/path/to/chrome` to override). It checks desktop, mobile, controls,
deep links, local assets, and a reload with third-party networking blocked. Screenshots are saved to
`test-results/`. To check an existing deployment:

```sh
BASE_URL=https://huangyingting.github.io/deeptime/ npm run test:browser
```

## Reference stack analysis

Inspection of the public HTML, CSS, JavaScript identifiers, network data, and
rendered UI found:

| Reference                                  | Evidence                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Vanilla JavaScript and direct DOM controls | Static HTML with named canvas, timeline, toolbar, and chapter elements                         |
| Vite-style build                           | Hashed `assets/index-*.js` module, stylesheet, module-preload runtime                          |
| Three.js / WebGL                           | Three.js renderer and shader identifiers in the public bundle                                  |
| Static scientific datasets                 | Local JSON for rotations, polygons, climate, cities, fossils, and map manifest                 |
| Raster globe textures                      | PALEOMAP age frames and NASA modern imagery                                                    |
| Typography                                 | Satoshi through Fontshare; Cormorant Garamond through Google Fonts                             |
| City search                                | Local GeoNames index and a Photon geocoding URL in the bundle                                  |
| Chapter media                              | Video elements, chapter prose, evidence, and citations                                         |
| Hosting                                    | `pplx.app` behind Cloudflare; no visible evidence of Next.js or a required application backend |

This repository replaces the minified application with readable, typed modules;
it does **not** claim to recover the original source or reproduce unknown-license
code. Next.js App Router statically exports React components. Three.js renders the
globe with an original shader and OrbitControls.

## Features and deliberate differences

- Rotatable, zoomable globe with atmospheric rim, clouds, and lighting.
- All 109 five-million-year PALEOMAP elevation frames from 0–540 Ma.
- Lower-confidence plate outlines from 540–1,100 Ma; explicitly artistic geography
  before 1,100 Ma, including a molten early Earth.
- Nonlinear 4.567-billion-year timeline and a finer, local-age timeline.
- 22 original chapters, evidence cards, citations, and procedural SVG landscapes.
- 22,849 offline searchable cities; finite Euler rotation interpolation and plate
  circuit composition reconstruct the land beneath a city.
- Sampled PBDB fossils, climate curves, illustrative ice, and modern-coastline
  layers; fossil hover details link to the original records.
- Forward playback, selectable speed, synthesized ambient sound, shareable deep
  links, keyboard controls, responsive panels, and a no-WebGL fallback.
- All imagery, fonts, and scientific assets are local. Sound is synthesized.

Unknown-license reference video clips and editorial copy are intentionally
replaced, not downloaded or republished. The visual system uses a local
OFL-licensed Cormorant Garamond and a system sans serif rather than redistributing
Satoshi. Search covers populated places in the local dataset, not every possible
address. Fossils are a sample, not the entire database. This is an independent
educational recreation, not an affiliated or endorsed product.

## Source map

| File                              | Responsibility                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `src/components/Experience.tsx`   | State, data loading, toolbar, dialogs, chapters, city search, sound, sharing          |
| `src/components/Globe.tsx`        | Three.js lifecycle, shader, textures, plate maps, pin, fossils, coastlines            |
| `src/components/Timeline.tsx`     | Pointer/keyboard timeline, markers, playback controls, climate plots                  |
| `src/components/ChapterScene.tsx` | Original illustrative SVG landscapes                                                  |
| `src/lib/earth.ts`                | Typed data models, nonlinear scale, interpolation, plate lookup, quaternion rotations |
| `src/lib/chapters.ts`             | Original chapter text and academic references                                         |
| `scripts/prepare-data.py`         | Reproducible scientific-data conversion, standard-library Python only                 |

## Scientific limitations

The globe switches to the nearest 5 Ma elevation map; it is not an interpolated
plate/deformation simulation. Maps are 1-degree source data, colorized by latitude
and elevation, not photographic paleolandscapes. Older continental geometry,
climate, oxygen, and CO₂ have large uncertainties. Missing values are not
extrapolated. City positions do not imply ancient settlements or whether a site
was submerged. Ice is a latitude-based visualization. The Last Glacial Maximum
chapter uses an illustrative ice-latitude override; other evidence cards retain
their underlying coarse climate-series resolution. The nonlinear timeline is
for exploration, not measuring equal durations visually.

## Assets and refresh

See [ATTRIBUTION.md](ATTRIBUTION.md) for individual sources and licenses.
The deployment uses checked-in assets; rebuilding does not download data.

```sh
bash scripts/fetch-assets.sh
curl -fL 'https://zenodo.org/records/5460860/files/PaleoDEMS_long_lat_elev_csv_v2.zip?download=1' -o /tmp/paleodem.zip
python3 scripts/prepare-data.py /tmp/paleodem.zip
```

The conversion reuses attributed factual climate/city/plate data tables published
by the reference and queries PBDB directly. Upstream availability is only needed
when refreshing assets.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` checks the source, exports with
`NEXT_PUBLIC_BASE_PATH=/deeptime`, runs browser regressions, and deploys `out/`
using GitHub Pages Actions. The base path is derived from the repository name.
Enable **Settings → Pages → Source → GitHub Actions**. Pushes to `main` redeploy.

The MIT license covers new application code and original writing/illustrations
only. Third-party data and assets retain their respective licenses.
