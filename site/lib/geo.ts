/**
 * Turning a pasted location into coordinates.
 *
 * The form asks for "a landmark, or paste map coordinates", which makes the
 * person do work a computer can do. This accepts whatever they actually have —
 * a bare pair of numbers, a Google Maps link, an OpenStreetMap link, a geo: URI
 * — and reports back what it understood.
 *
 * Deliberately no tile map: a map library plus tile requests is a poor trade
 * for people on metered data in a disaster, and OpenStreetMap's tile policy
 * rules out serving them at volume from someone else's infrastructure. A
 * parsed, confirmed coordinate and an open-in-map link do the same job.
 */

export type Coordinates = { lat: number; lon: number };

export type ParseResult =
  | { kind: "empty" }
  | { kind: "text" }
  | { kind: "coords"; coords: Coordinates; inNepal: boolean };

/** Nepal's approximate bounding box, used only to warn — never to block. */
const NEPAL_BOUNDS = { minLat: 26.34, maxLat: 30.45, minLon: 80.05, maxLon: 88.21 };

const NUMBER_PAIR = /(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/;

export function isInNepal({ lat, lon }: Coordinates): boolean {
  return (
    lat >= NEPAL_BOUNDS.minLat &&
    lat <= NEPAL_BOUNDS.maxLat &&
    lon >= NEPAL_BOUNDS.minLon &&
    lon <= NEPAL_BOUNDS.maxLon
  );
}

function valid({ lat, lon }: Coordinates): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    // A bare "7, 40" is far more likely to be a ward number than a coordinate.
    !(lat === 0 && lon === 0)
  );
}

/**
 * Extract coordinates from free text. Returns `text` when the input looks like
 * a landmark description rather than a location — that is a valid answer, not
 * an error.
 */
export function parseLocation(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return { kind: "empty" };

  const coords = extractCoords(input);
  if (!coords) return { kind: "text" };

  return { kind: "coords", coords, inNepal: isInNepal(coords) };
}

function extractCoords(input: string): Coordinates | null {
  // OpenStreetMap: #map=15/27.7172/85.3240
  const osm = /#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(input);
  if (osm) {
    const c = { lat: Number(osm[1]), lon: Number(osm[2]) };
    if (valid(c)) return c;
  }

  // Google Maps: /@27.7172,85.3240,17z
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input);
  if (at) {
    const c = { lat: Number(at[1]), lon: Number(at[2]) };
    if (valid(c)) return c;
  }

  // geo:27.7172,85.3240 — and ?q= / ?query= / ?ll= parameters
  const param = /(?:geo:|[?&](?:q|query|ll|mlat|destination)=)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(
    input
  );
  if (param) {
    const c = { lat: Number(param[1]), lon: Number(param[2]) };
    if (valid(c)) return c;
  }

  // A bare pair, but only when the input is essentially just that pair.
  // "Ward 7, 40 houses" must not parse as a coordinate.
  if (/^[-\d.,\s°NSEW]+$/i.test(input)) {
    const pair = NUMBER_PAIR.exec(input);
    if (pair) {
      const c = { lat: Number(pair[1]), lon: Number(pair[2]) };
      if (valid(c)) return c;
    }
  }

  return null;
}

/** Round for display; six decimals is about 10cm, far more than enough. */
export function formatCoords({ lat, lon }: Coordinates): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/** An OpenStreetMap link for confirming a parsed point in a new tab. */
export function mapUrl({ lat, lon }: Coordinates): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}
