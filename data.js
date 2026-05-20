/**
 * NorthAir Ops — Mock Data Layer
 *
 * PLUG-AND-PLAY: Replace each `fetch*` function with a real API call.
 * All functions return the same contract regardless of data source.
 *
 * Live integrations to swap in:
 *   fetchWeather()      → tomorrow.io /timelines endpoint
 *   fetchAtcFlow()      → FAA ATCSCC ASDI feed or FlightAware AeroAPI
 *   fetchCrewRosters()  → Airline OCC / AIMS / Jeppesen Crew API
 *   fetchFlightSchedule() → OAG, SSIM feed, or internal OCC system
 *   fetchTurnaround()   → Turnaround.ai /predictions endpoint
 */

// ─── AIRPORTS ────────────────────────────────────────────────────────────────
export const AIRPORTS = {
  NRT: { name: "Tokyo Narita",      city: "Tokyo",     tz: "Asia/Tokyo",     lat: 35.77, lon: 140.39 },
  BOM: { name: "Mumbai Chhatrapati",city: "Mumbai",    tz: "Asia/Kolkata",   lat: 19.09, lon: 72.86 },
  DXB: { name: "Dubai International",city: "Dubai",   tz: "Asia/Dubai",     lat: 25.25, lon: 55.36 },
  SIN: { name: "Singapore Changi",  city: "Singapore", tz: "Asia/Singapore", lat: 1.36,  lon: 103.99 },
  LHR: { name: "London Heathrow",   city: "London",    tz: "Europe/London",  lat: 51.48, lon: -0.46 },
  JFK: { name: "New York JFK",      city: "New York",  tz: "America/New_York",lat: 40.64, lon: -73.78 },
};

// ─── FLEET ───────────────────────────────────────────────────────────────────
// histAvgDelayMin: rolling 90-day historical average delay for this tail [MOCK]
export const FLEET = [
  { tail: "NA-001", type: "B789", name: "Dreamliner Alpha",    hub: "NRT", status: "active",      histAvgDelayMin: 18 },
  { tail: "NA-002", type: "B789", name: "Dreamliner Bravo",    hub: "NRT", status: "active",      histAvgDelayMin: 42 },
  { tail: "NA-003", type: "A359", name: "Airbus Sierra",       hub: "BOM", status: "active",      histAvgDelayMin: 22 },
  { tail: "NA-004", type: "A359", name: "Airbus Tango",        hub: "BOM", status: "maintenance", histAvgDelayMin: 55 },
  { tail: "NA-005", type: "B77W", name: "Triple Seven Echo",   hub: "DXB", status: "active",      histAvgDelayMin: 8  },
  { tail: "NA-006", type: "B77W", name: "Triple Seven Foxtrot",hub: "DXB", status: "active",      histAvgDelayMin: 11 },
  { tail: "NA-007", type: "A333", name: "Airbus Golf",         hub: "SIN", status: "active",      histAvgDelayMin: 19 },
  { tail: "NA-008", type: "A333", name: "Airbus Hotel",        hub: "SIN", status: "active",      histAvgDelayMin: 14 },
];

// ─── TOMORROW: STD departure times (UTC) ─────────────────────────────────────
// Format: YYYY-MM-DD auto-set to tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const D = tomorrow.toISOString().slice(0, 10);

export const SCHEDULE = [
  { flt: "NA101", tail: "NA-001", dep: "NRT", arr: "LHR", std: `${D}T00:30Z`, sta: `${D}T05:45Z`, pax: 287, crew: { captain:"C.Yamamoto", fo:"A.Patel", fa:8 } },
  { flt: "NA102", tail: "NA-002", dep: "LHR", arr: "NRT", std: `${D}T07:15Z`, sta: `${D}T06:00Z`, pax: 301, crew: { captain:"S.Tanaka",   fo:"R.Singh",  fa:8 } },
  { flt: "NA201", tail: "NA-003", dep: "BOM", arr: "DXB", std: `${D}T02:00Z`, sta: `${D}T04:00Z`, pax: 215, crew: { captain:"V.Mehta",    fo:"L.Gomez",  fa:7 } },
  { flt: "NA202", tail: "NA-005", dep: "DXB", arr: "BOM", std: `${D}T05:30Z`, sta: `${D}T09:30Z`, pax: 198, crew: { captain:"K.Al-Rashid",fo:"J.Chen",   fa:7 } },
  { flt: "NA301", tail: "NA-006", dep: "DXB", arr: "LHR", std: `${D}T08:00Z`, sta: `${D}T12:30Z`, pax: 342, crew: { captain:"M.Hassan",   fo:"T.Brown",  fa:9 } },
  { flt: "NA302", tail: "NA-007", dep: "SIN", arr: "DXB", std: `${D}T09:15Z`, sta: `${D}T13:00Z`, pax: 276, crew: { captain:"P.Lim",      fo:"S.Kumar",  fa:8 } },
  { flt: "NA401", tail: "NA-008", dep: "SIN", arr: "NRT", std: `${D}T11:00Z`, sta: `${D}T18:45Z`, pax: 263, crew: { captain:"H.Nakamura", fo:"W.Osei",   fa:8 } },
  { flt: "NA501", tail: "NA-001", dep: "LHR", arr: "JFK", std: `${D}T13:00Z`, sta: `${D}T16:00Z`, pax: 289, crew: { captain:"C.Yamamoto", fo:"A.Patel",  fa:8 } },
  { flt: "NA502", tail: "NA-002", dep: "NRT", arr: "SIN", std: `${D}T14:30Z`, sta: `${D}T19:30Z`, pax: 244, crew: { captain:"S.Tanaka",   fo:"R.Singh",  fa:7 } },
  { flt: "NA601", tail: "NA-003", dep: "DXB", arr: "SIN", std: `${D}T16:00Z`, sta: `${D}T22:30Z`, pax: 311, crew: { captain:"V.Mehta",    fo:"L.Gomez",  fa:8 } },
];

// ─── MOCK: tomorrow.io weather forecast ──────────────────────────────────────
// SWAP: replace with real tomorrow.io /timelines?location=lat,lon&fields=precipitationProbability,windSpeed,cloudCeiling,weatherCode
export async function fetchWeather(airportCode) {
  await delay(80);
  const conditions = {
    NRT: { code: "THUNDER_STORM",    windKt: 38, ceilingFt: 800,  precipPct: 85, visibility: 1.2, label: "Thunderstorm Activity" },
    BOM: { code: "HEAVY_RAIN",       windKt: 22, ceilingFt: 2000, precipPct: 70, visibility: 3.0, label: "Heavy Monsoon Rain" },
    DXB: { code: "CLEAR",            windKt: 8,  ceilingFt: null, precipPct: 2,  visibility: 10,  label: "Clear" },
    SIN: { code: "ISOLATED_SHOWERS", windKt: 15, ceilingFt: 3500, precipPct: 40, visibility: 6.0, label: "Isolated Showers" },
    LHR: { code: "LOW_CLOUD",        windKt: 18, ceilingFt: 600,  precipPct: 55, visibility: 2.5, label: "Low Cloud / Fog" },
    JFK: { code: "CLEAR",            windKt: 10, ceilingFt: null, precipPct: 5,  visibility: 10,  label: "Clear" },
  };
  return { airport: airportCode, source: "tomorrow.io [MOCK]", data: conditions[airportCode] || { code:"CLEAR", windKt:5, ceilingFt:null, precipPct:0, visibility:10, label:"Clear" } };
}

// ─── MOCK: ATC flow control ───────────────────────────────────────────────────
// SWAP: replace with FAA ATCSCC API or FlightAware AeroAPI /airports/{id}/delays
export async function fetchAtcFlow(airportCode) {
  await delay(60);
  const delays = {
    NRT: { gdp: true,  avgDelayMin: 95, reason: "Convective activity, GDP in effect",  severity: "high" },
    BOM: { gdp: false, avgDelayMin: 35, reason: "Rain, reduced capacity single runway", severity: "medium" },
    DXB: { gdp: false, avgDelayMin: 0,  reason: "Normal operations",                    severity: "none" },
    SIN: { gdp: false, avgDelayMin: 12, reason: "Minor flow restriction",               severity: "low" },
    LHR: { gdp: true,  avgDelayMin: 55, reason: "Low visibility procedures (CAT II)",   severity: "high" },
    JFK: { gdp: false, avgDelayMin: 5,  reason: "Normal operations",                    severity: "none" },
  };
  return { airport: airportCode, source: "FAA ATCSCC [MOCK]", data: delays[airportCode] };
}

// ─── MOCK: Crew roster & duty times ─────────────────────────────────────────
// SWAP: replace with AIMS, Jeppesen Crew, or airline OCC crew API
export async function fetchCrewStatus(flightNumber) {
  await delay(50);
  const crewFlags = {
    NA101: { dutyHours: 11.5, restHours: 9.5,  atRisk: true,  issue: "Captain at 11.5h duty — approaching FDP limit" },
    NA102: { dutyHours: 6.0,  restHours: 14.0, atRisk: false, issue: null },
    NA201: { dutyHours: 8.5,  restHours: 11.0, atRisk: false, issue: null },
    NA202: { dutyHours: 9.8,  restHours: 9.0,  atRisk: true,  issue: "F/O approaching rest minimum — check FDP extension" },
    NA301: { dutyHours: 7.2,  restHours: 12.5, atRisk: false, issue: null },
    NA302: { dutyHours: 10.9, restHours: 8.5,  atRisk: true,  issue: "Full crew at 10.9h duty — FDP breach risk if delayed" },
    NA401: { dutyHours: 5.5,  restHours: 16.0, atRisk: false, issue: null },
    NA501: { dutyHours: 12.0, restHours: 9.0,  atRisk: true,  issue: "CRITICAL: Captain C.Yamamoto exceeds FDP — relief crew required" },
    NA502: { dutyHours: 6.5,  restHours: 13.5, atRisk: false, issue: null },
    NA601: { dutyHours: 4.5,  restHours: 18.0, atRisk: false, issue: null },
  };
  return { flight: flightNumber, source: "AIMS Crew [MOCK]", data: crewFlags[flightNumber] || { dutyHours:5, restHours:16, atRisk:false, issue:null } };
}

// ─── MOCK: Turnaround AI ground ops prediction ───────────────────────────────
// SWAP: replace with Turnaround.ai /api/v1/predictions
export async function fetchTurnaroundPrediction(tail, depAirport) {
  await delay(70);
  const predictions = {
    "NA-001_LHR": { stdTurnaround: 90, predictedTurnaround: 140, delayRisk: "high",   bottleneck: "Catering delayed — low ceiling ops", confidence: 0.82 },
    "NA-002_NRT": { stdTurnaround: 90, predictedTurnaround: 165, delayRisk: "critical",bottleneck: "Ground stop — thunderstorm hold",     confidence: 0.91 },
    "NA-003_BOM": { stdTurnaround: 75, predictedTurnaround: 95,  delayRisk: "medium",  bottleneck: "Baggage load slowed by rain",         confidence: 0.74 },
    "NA-005_DXB": { stdTurnaround: 75, predictedTurnaround: 75,  delayRisk: "none",    bottleneck: null,                                  confidence: 0.95 },
    "NA-006_DXB": { stdTurnaround: 80, predictedTurnaround: 80,  delayRisk: "none",    bottleneck: null,                                  confidence: 0.93 },
    "NA-007_SIN": { stdTurnaround: 75, predictedTurnaround: 90,  delayRisk: "low",     bottleneck: "Minor gate congestion",               confidence: 0.68 },
    "NA-008_SIN": { stdTurnaround: 75, predictedTurnaround: 88,  delayRisk: "low",     bottleneck: "Refueling slightly behind",           confidence: 0.71 },
  };
  const key = `${tail}_${depAirport}`;
  return { tail, airport: depAirport, source: "Turnaround.ai [MOCK]", data: predictions[key] || { stdTurnaround:80, predictedTurnaround:80, delayRisk:"none", bottleneck:null, confidence:0.70 } };
}

// ─── PASSENGERS: representative sample per flight ────────────────────────────
export function generatePassengerSample(flightNumber, count = 8) {
  const names = ["Sarah Mitchell","James O'Brien","Priya Sharma","Kenji Watanabe","Fatima Al-Zahraa","Carlos Mendez","Emma Johansson","David Okafor","Li Wei","Amara Nwosu"];
  const statuses = ["Gold","Platinum","Silver","Standard","Standard","Standard","Gold","Standard","Platinum","Standard"];
  const connections = [null, "NA502 SIN 19:30", null, "BA278 LHR 06:30", null, null, "EK007 DXB 15:00", null, "SQ321 SIN 20:00", null];
  const special = [null, null, "Unaccompanied Minor", null, "Medical — wheelchair", null, null, null, null, "Infant"];
  const sample = [];
  for (let i = 0; i < Math.min(count, names.length); i++) {
    sample.push({ name: names[i], ffStatus: statuses[i], connection: connections[i], specialNeed: special[i], seat: `${(i+1)*4}${['A','C','D','F'][i%4]}` });
  }
  return sample;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
