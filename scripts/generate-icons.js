const sharp = require('sharp');
const path = require('path');

const BRAND_BLUE = '#2563eb';

// Original SVG coordinates (within 8.5x11 viewBox):
//   Blue square: x=2.37467 y=4.09008 w=6.526 h=6.52646
//   Pump body:   M3.59434,4.79504 → w=3.30324 h=5.11654
//   Window:      M3.98451,5.35140 → w=2.5229  h=1.20381  (evenodd cutout)
//   Nozzle:      x=7.19759 y=5.80735 w=0.483402 h=3.50466
//
// Normalized to 0-1 relative to blue square, then mapped to 100x100 with 10% padding

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect fill="${BRAND_BLUE}" x="0" y="0" width="100" height="100"/>
  <!-- Pump body with evenodd window cutout -->
  <path fill="white" fill-rule="evenodd" d="
    M 24.95 18.64 h 40.50 v 62.73 h -40.50 z
    M 29.74 25.46 h 30.93 v 14.75 h -30.93 z
  "/>
  <!-- Nozzle holder -->
  <rect fill="white" x="69.13" y="31.06" width="5.93" height="42.98"/>
</svg>
`;

async function generate() {
  const publicDir = path.join(__dirname, '..', 'public');

  await sharp(Buffer.from(svgIcon))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  await sharp(Buffer.from(svgIcon))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated icon-192.png');
}

generate().catch(console.error);
