"""Build local, attributed scientific assets; no runtime APIs are required."""

import csv
import io
import json
import math
import pathlib
import re
import struct
import subprocess
import sys
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"


def fetch(url):
    return subprocess.check_output(["curl", "-fsSL", "--retry", "3", url])


def png(width, height, pixels):
    def chunk(kind, content):
        return (
            struct.pack(">I", len(content))
            + kind
            + content
            + struct.pack(">I", zlib.crc32(kind + content))
        )

    scanlines = b"".join(
        b"\0" + pixels[y * width * 3 : (y + 1) * width * 3]
        for y in range(height)
    )
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(scanlines, 9))
        + chunk(b"IEND", b"")
    )


def make_maps(archive):
    target = DATA / "maps"
    target.mkdir(parents=True, exist_ok=True)
    ages = []
    with zipfile.ZipFile(archive) as source:
        (target / "LICENSE.txt").write_bytes(source.read("License.txt"))
        for name in source.namelist():
            match = re.search(r"_(\d+)Ma\.csv$", name)
            if not match:
                continue
            age = int(match[1])
            # Keep five-million-year frames, including a separate modern map.
            if age % 5:
                continue
            pixels = bytearray(360 * 181 * 3)
            rows = csv.reader(io.StringIO(source.read(name).decode(), newline=""))
            next(rows)
            for lon, lat, elevation in rows:
                lon, lat, elevation = float(lon), float(lat), float(elevation)
                x, y = round(lon + 180) % 360, round(90 - lat)
                latitude = abs(lat)
                if elevation < 0:
                    depth = min(1, -elevation / 4500)
                    color = (
                        12 + 8 * (1 - depth),
                        37 + 80 * (1 - depth) ** 3,
                        67 + 65 * (1 - depth) ** 2,
                    )
                else:
                    desert = math.exp(-((latitude - 26) / 12) ** 2)
                    high = min(1, elevation / 5000)
                    color = (
                        55 + desert * 91 + high * 55,
                        83 + desert * 45 + high * 25,
                        54 + desert * 25 + high * 38,
                    )
                i = (y * 360 + x) * 3
                pixels[i : i + 3] = bytes(max(0, min(255, round(c))) for c in color)
            (target / f"{age}.png").write_bytes(png(360, 181, pixels))
            ages.append(age)
    (target / "manifest.json").write_text(json.dumps(sorted(set(ages))))
    print(f"Generated {len(ages)} PALEOMAP textures")


def make_tables():
    # These are factual, CC-BY data conversions, not the reference's application code.
    cities = json.loads(fetch("https://deeptime.pplx.app/data/cities.json"))
    compact = [
        {
            "name": row[0],
            "aliases": row[1],
            "country": cities["countries"].get(row[2], row[2]),
            "lat": row[3],
            "lon": row[4],
        }
        for row in cities["cities"]
    ]
    (DATA / "cities.json").write_text(json.dumps(compact, separators=(",", ":")))
    curves = json.loads(fetch("https://deeptime.pplx.app/data/curves.json"))
    keep = {
        key: {"source": curves[key]["source"], "points": sorted(curves[key]["points"])}
        for key in ["gmst", "sea_level", "co2_proxy", "co2_model", "o2_model", "ice_lat"]
    }
    (DATA / "climate.json").write_text(json.dumps(keep, separators=(",", ":")))
    fossils = []
    seen = set()
    for younger, older in [(0, 30), (30, 66), (66, 145), (145, 252), (252, 359), (359, 450), (450, 541)]:
        url = (
            "https://paleobiodb.org/data1.2/occs/list.json?"
            f"min_ma={younger}&max_ma={older}&show=coords,class&limit=400"
        )
        for row in json.loads(fetch(url)).get("records", []):
            if not row.get("lat") or not row.get("lng"):
                continue
            key = (row["lat"], row["lng"], row.get("gnl"))
            if key in seen:
                continue
            seen.add(key)
            fossils.append(
                {
                    "id": row["oid"].split(":")[-1],
                    "name": row.get("tna", row.get("gnl", "Fossil occurrence")),
                    "lat": float(row["lat"]),
                    "lon": float(row["lng"]),
                    "min": row.get("lag", younger),
                    "max": row.get("eag", older),
                }
            )
    (DATA / "fossils.json").write_text(json.dumps(fossils, separators=(",", ":")))
    print(f"Prepared {len(compact)} cities and {len(fossils)} sampled fossil occurrences")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        make_maps(sys.argv[1])
    make_tables()
