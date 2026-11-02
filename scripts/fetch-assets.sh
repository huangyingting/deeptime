#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/assets public/data
curl -fsSL --retry 3 https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg -o public/assets/earth.jpg
curl -fsSL --retry 3 https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg -o public/assets/clouds.jpg
curl -fsSL --retry 3 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf' -o public/assets/cormorant-garamond.ttf
curl -fsSL --retry 3 https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt -o public/assets/FONT-LICENSE.txt
curl -fsSL --retry 3 https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson -o public/data/coastlines.geojson
curl -fsSL --retry 3 https://deeptime.pplx.app/data/rotations.json -o public/data/rotations.json
curl -fsSL --retry 3 https://deeptime.pplx.app/data/plate_polygons.json -o public/data/plates.json
