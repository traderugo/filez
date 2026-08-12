/**
 * Premeval brand mark: the lowercase "p" with an orange dot. Self-contained SVG.
 *
 * variant: 'full' (blue p + orange dot, default)
 *          'icon' (blue p + orange dot on a white card, for app icons and anywhere the mark
 *                  needs to carry its own background)
 *          'dark' (white p + orange dot, for dark backgrounds)
 *
 * Colours are sampled from wacart/public/icons/logo-dp.png, which is the current mark.
 * Do not take them from posters/premeval-logo.PNG: that one is an older single-colour
 * version with a blue dot, and using it turns the mark the wrong shade and loses the
 * orange entirely. wacart/public/icons/logo-new.svg is also stale too: right blue, but a
 * red (#ED2E38) dot.
 *
 * These are deliberately their own constants rather than --primary-500/--accent-500.
 * The UI blue is #1DA1F2, a brighter shade than the logo's, so tying them together would
 * quietly repaint the logo the next time the palette is tuned.
 *
 * The path is identical to logo-new.svg; only the colours ever differed.
  *
 * Ported verbatim from store-portal so the two apps carry an identical mark.
 */
/**
 * The card is drawn as a plain rect rather than logo-dp's own path, purely so the corner
 * radius is a number we control. The artwork rounds at 230.368 of 1996.53, about 11.5%,
 * which reads too soft next to a design system whose house rule is square corners.
 *
 * CARD_RADIUS is the one number to change. 96 is roughly 4.8%: still clearly a rounded
 * square, but much tighter than the source. Set it to 0 for fully square.
 *
 * Everything else about the card matches the artwork exactly: same origin, same size.
 */
const CARD_X = 178.475
const CARD_Y = 1071.98
const CARD_SIZE = 1996.53
const CARD_RADIUS = 96
const DP_LETTER = "M805.442 1529.38c46.8331,-47.7083 92.8417,-89.889 146.576,-118.267 68.648,-36.2528 145.233,-54.3815 229.894,-54.3815 147.515,0 273.859,53.4035 378.713,159.557 104.856,106.16 157.281,233.807 157.281,383.274 0,152.721 -51.7736,282.325 -155.976,388.806 -103.878,106.48 -229.248,159.888 -376.437,159.888 -82.3843,0 -158.58,-17.2594 -227.943,-51.4524 -69.3579,-34.5189 -131.881,-85.6394 -187.887,-153.699l0 131.17 0 63.1547c0,52.9783 -132.533,48.9024 -132.533,0.607087l0 -59.9882 0 -105.863c0,-257.986 -29.6528,-541.17 168.312,-742.805zm366.053 -43.6972c-115.925,0 -213.293,40.3772 -292.422,121.131 -79.4551,80.7602 -118.854,181.382 -118.854,301.54 0,78.8043 17.5854,149.792 52.7516,212.636 35.4969,63.1736 85.9701,112.996 151.748,149.792 65.7768,36.7961 135.462,55.3594 208.402,55.3594 71.9669,0 139.7,-18.5634 202.874,-55.6854 63.1689,-37.448 113.643,-89.2217 151.091,-155.978 37.774,-66.7547 56.3374,-136.766 56.3374,-210.032 0,-73.5969 -18.5634,-143.608 -55.6854,-209.711 -37.122,-66.4299 -87.2705,-117.55 -150.444,-154.351 -62.8488,-36.4701 -131.555,-54.7028 -205.799,-54.7028z"
const DP_DOT = "M718.586 2620.85c44.9811,0 81.4559,36.4748 81.4559,81.4559 0,44.9799 -36.4748,81.4559 -81.4559,81.4559 -44.9787,0 -81.4559,-36.476 -81.4559,-81.4559 0,-44.9811 36.4772,-81.4559 81.4559,-81.4559z"
/**
 * The card's true bounds, traced from CARD_PATH rather than read off its first two numbers.
 *
 * The path opens at (408.843, 1071.98), which is where the top edge begins *after* the
 * top-left corner arc, so the card's actual left edge is 230.368 further left at 178.475.
 * Each side is a 1535.79 straight run plus a 230.368 arc at both ends, making the square
 * 1996.53 across, not 1535.79.
 *
 * Getting either wrong is visible: the straight run alone crops the card and cuts the dot
 * off completely, and starting x at 408.843 shoves the whole mark left out of frame.
 */
const CARD_BOX = "178.475 1071.98 1996.53 1996.53"
const CARD_EDGE = "#DEDEDD"

const BRAND = '#0093DD'
const BRAND_DOT = '#F57D00'

export default function PremevalLogo({ className = 'w-8 h-8', variant = 'full' }) {
  const aPath = "M578.862 2085.6c29.9091,-30.4665 59.2902,-57.4039 93.6059,-75.5268 43.839,-23.1508 92.7461,-34.728 146.812,-34.728 94.2047,0 174.888,34.1043 241.851,101.895 66.9614,67.7953 100.441,149.311 100.441,244.762 0,97.5295 -33.0626,180.295 -99.6083,248.295 -66.3378,67.9996 -146.4,102.106 -240.396,102.106 -52.6122,0 -101.271,-11.022 -145.567,-32.8571 -44.2937,-22.0441 -84.2209,-54.6909 -119.987,-98.1543l0 83.7661 0 40.3311c0,33.8327 -84.6366,31.2295 -84.6366,0.387402l0 -38.3091 0 -67.6051c0,-164.752 -18.9366,-345.596 107.485,-474.363zm233.765 -27.9047c-74.0303,0 -136.209,25.7846 -186.743,77.3551 -50.7413,51.574 -75.9012,115.833 -75.9012,192.567 0,50.3244 11.2299,95.6587 33.6874,135.791 22.6677,40.3429 54.9012,72.1606 96.9071,95.6587 42.0071,23.498 86.5075,35.3528 133.088,35.3528 45.9591,0 89.2146,-11.8547 129.557,-35.5618 40.3406,-23.9138 72.574,-56.9776 96.489,-99.6071 24.1228,-42.6307 35.9776,-87.3402 35.9776,-134.13 0,-46.9996 -11.8547,-91.7091 -35.5618,-133.923 -23.7059,-42.4228 -55.7315,-75.0685 -96.0744,-98.5701 -40.1362,-23.2902 -84.013,-34.9335 -131.426,-34.9335z"
  const dotCx = 523.396, dotCy = 2834.65, dotR = 52.018
  const viewBox = "455 1960 725 945"

  // The app icon, reproduced from logo-dp.SVG rather than assembled by hand: its own card,
  // letter and dot paths, cropped to the card's bounds so the spacing is the artwork's own.
  //
  // What was here before drew the rect at exactly the glyph's viewBox, so the "p" touched
  // all four edges with no padding at all, and inverted the artwork to a white letter on a
  // blue square with a white dot. The real icon is a blue letter and an orange dot on a
  // white card, with roughly 14% air above and below the mark.
  if (variant === 'icon') {
    return (
      <svg viewBox={CARD_BOX} xmlns="http://www.w3.org/2000/svg" className={className} style={{ shapeRendering: 'geometricPrecision' }}>
        <rect
          x={CARD_X} y={CARD_Y} width={CARD_SIZE} height={CARD_SIZE} rx={CARD_RADIUS}
          fill="white" stroke={CARD_EDGE} strokeWidth="0.9"
        />
        <path d={DP_LETTER} fill={BRAND} fillRule="nonzero" />
        <path d={DP_DOT} fill={BRAND_DOT} />
      </svg>
    )
  }
  if (variant === 'dark') {
    return (
      <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className={className} style={{ shapeRendering: 'geometricPrecision' }}>
        <path d={aPath} fill="white" fillRule="nonzero" />
        <circle cx={dotCx} cy={dotCy} r={dotR} fill={BRAND_DOT} />
      </svg>
    )
  }
  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className={className} style={{ shapeRendering: 'geometricPrecision' }}>
      <path d={aPath} fill={BRAND} fillRule="nonzero" />
      <circle cx={dotCx} cy={dotCy} r={dotR} fill={BRAND_DOT} />
    </svg>
  )
}
