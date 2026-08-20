export interface GPXPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
  elevation?: number;
}

export interface GPXTrack {
  vesselNumber: string;
  competitorName: string;
  category?: string;
  modality?: string;
  club?: string;
  largadaTitle?: string;
  points: GPXPoint[];
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Generates GPX 1.1 XML string for a single track
 */
export function generateSingleGPX(track: GPXTrack): string {
  const name = `${track.vesselNumber} - ${track.competitorName}`;
  const desc = [
    track.largadaTitle ? `Largada: ${track.largadaTitle}` : "",
    track.modality ? `Modalidade: ${track.modality}` : "",
    track.category ? `Categoria: ${track.category}` : "",
    track.club ? `Clube: ${track.club}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const isoTime = track.points.length > 0 ? new Date(track.points[0].timestamp).toISOString() : new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VaaTracker - Sistema de Rastreamento de Canoa Polinesia"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc || "Rastreamento GPS VaaTracker")}</desc>
    <time>${isoTime}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
    <trkseg>
`;

  for (const pt of track.points) {
    const ptTime = new Date(pt.timestamp).toISOString();
    const ele = typeof pt.elevation === "number" ? `<ele>${pt.elevation.toFixed(1)}</ele>` : "<ele>0.0</ele>";
    const accComment = pt.accuracy ? `<hdop>${(pt.accuracy / 5).toFixed(1)}</hdop>` : "";
    xml += `      <trkpt lat="${pt.latitude.toFixed(7)}" lon="${pt.longitude.toFixed(7)}">
        ${ele}
        <time>${ptTime}</time>${accComment ? `\n        ${accComment}` : ""}
      </trkpt>\n`;
  }

  xml += `    </trkseg>
  </trk>
</gpx>`;

  return xml;
}

/**
 * Generates GPX 1.1 XML string for multiple tracks (multi-track GPX)
 */
export function generateMultiGPX(tracks: GPXTrack[], eventTitle = "VaaTracker - Relatorio Geral da Prova"): string {
  const isoTime = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VaaTracker - Sistema de Rastreamento de Canoa Polinesia"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(eventTitle)}</name>
    <desc>Exportacao consolidada de todas as canoas rastreadas</desc>
    <time>${isoTime}</time>
  </metadata>
`;

  for (const track of tracks) {
    if (!track.points || track.points.length === 0) continue;
    const name = `${track.vesselNumber} - ${track.competitorName}`;
    const desc = [
      track.largadaTitle ? `Largada: ${track.largadaTitle}` : "",
      track.modality ? `Modalidade: ${track.modality}` : "",
      track.category ? `Categoria: ${track.category}` : "",
      track.club ? `Clube: ${track.club}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    xml += `  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(desc)}</desc>
    <trkseg>\n`;

    for (const pt of track.points) {
      const ptTime = new Date(pt.timestamp).toISOString();
      const ele = typeof pt.elevation === "number" ? `<ele>${pt.elevation.toFixed(1)}</ele>` : "<ele>0.0</ele>";
      xml += `      <trkpt lat="${pt.latitude.toFixed(7)}" lon="${pt.longitude.toFixed(7)}">
        ${ele}
        <time>${ptTime}</time>
      </trkpt>\n`;
    }

    xml += `    </trkseg>
  </trk>\n`;
  }

  xml += `</gpx>`;

  return xml;
}

/**
 * Triggers a browser download of the generated GPX file
 */
export function downloadGPXFile(filename: string, content: string) {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: "application/gpx+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".gpx") ? filename : `${filename}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Calculates total distance (in km) and average/max speed from track points
 */
export function calculateTrackStats(points: GPXPoint[]) {
  if (!points || points.length < 2) {
    return {
      distanceKm: 0,
      durationMinutes: 0,
      avgSpeedKmH: 0,
      maxSpeedKmH: 0,
      avgSpeedKnots: 0,
      maxSpeedKnots: 0,
    };
  }

  let totalDistMeters = 0;
  let maxSpeedMps = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dMeters = haversineDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    totalDistMeters += dMeters;

    const timeDiffSec = (p2.timestamp - p1.timestamp) / 1000;
    if (timeDiffSec > 0 && timeDiffSec < 300) {
      const speedMps = dMeters / timeDiffSec;
      // Filter out GPS jump glitches (> 40 knots / ~20 m/s for a canoe)
      if (speedMps < 22 && speedMps > maxSpeedMps) {
        maxSpeedMps = speedMps;
      }
    }
  }

  const durationSec = Math.max(1, (points[points.length - 1].timestamp - points[0].timestamp) / 1000);
  const distanceKm = totalDistMeters / 1000;
  const durationMinutes = durationSec / 60;
  const avgSpeedKmH = durationSec > 0 ? (totalDistMeters / durationSec) * 3.6 : 0;
  const maxSpeedKmH = maxSpeedMps * 3.6;
  const avgSpeedKnots = avgSpeedKmH * 0.539957;
  const maxSpeedKnots = maxSpeedKmH * 0.539957;

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: Number(durationMinutes.toFixed(1)),
    avgSpeedKmH: Number(avgSpeedKmH.toFixed(1)),
    maxSpeedKmH: Number(maxSpeedKmH.toFixed(1)),
    avgSpeedKnots: Number(avgSpeedKnots.toFixed(1)),
    maxSpeedKnots: Number(maxSpeedKnots.toFixed(1)),
  };
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
