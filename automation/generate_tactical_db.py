import json
import math
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Geospatial AO for national Nigeria cache generation.
MIN_LAT, MAX_LAT = 4.0, 14.1
MIN_LNG, MAX_LNG = 2.6, 14.6
STEP_LAT = 0.15
STEP_LNG = 0.15

ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "src" / "data" / "tactical_db.json"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

HOTSPOTS = [
    {"id": "s1", "label": "SAMBISA_CORE", "lat": 11.5, "lng": 13.5, "radius": 0.85, "threat": 10, "reason": "Persistent insurgent sanctuary terrain with forest cover and cross-border mobility."},
    {"id": "s2", "label": "LAKE_CHAD_AXIS", "lat": 13.25, "lng": 14.05, "radius": 0.65, "threat": 10, "reason": "Island and shoreline routes support militant movement and concealment."},
    {"id": "s3", "label": "ALAGARNO_CORRIDOR", "lat": 11.75, "lng": 12.85, "radius": 0.45, "threat": 9, "reason": "Historic insurgent transit corridor between forested enclaves."},
    {"id": "s4", "label": "MANDARA_APPROACH", "lat": 10.85, "lng": 13.45, "radius": 0.55, "threat": 8, "reason": "Mountain terrain favors concealment and cross-border egress."},
    {"id": "s5", "label": "KUKAWA_SHORE", "lat": 12.9, "lng": 13.55, "radius": 0.45, "threat": 9, "reason": "Lake Chad logistics pressure and vulnerable settlement approaches."},
    {"id": "s6", "label": "KUYAMBANA_FOREST", "lat": 10.55, "lng": 6.45, "radius": 0.8, "threat": 9, "reason": "Forest refuge assessed as high-risk bandit staging ground."},
    {"id": "s7", "label": "KAMUKU_FOREST", "lat": 10.75, "lng": 6.15, "radius": 0.55, "threat": 8, "reason": "Wooded terrain near rural corridors increases interdiction difficulty."},
    {"id": "s8", "label": "BIRNIN_GWARI", "lat": 10.62, "lng": 6.72, "radius": 0.5, "threat": 9, "reason": "Kidnapping risk along rural roads and forest margins remains elevated."},
    {"id": "s9", "label": "RUGU_FOREST", "lat": 12.15, "lng": 7.25, "radius": 0.7, "threat": 8, "reason": "Forest belt enables cross-state movement in the northwest."},
    {"id": "s10", "label": "FALGORE_FOREST", "lat": 10.95, "lng": 8.55, "radius": 0.45, "threat": 7, "reason": "Forest concealment near regional transit routes raises ambush risk."},
    {"id": "s11", "label": "ABUJA_KADUNA_HWY", "lat": 9.75, "lng": 7.48, "radius": 0.45, "threat": 8, "reason": "High-value transit corridor with recurring kidnap and ambush exposure."},
    {"id": "s12", "label": "MINNA_AXIS", "lat": 9.62, "lng": 6.55, "radius": 0.45, "threat": 7, "reason": "Rural road network links northwest and central threat clusters."},
    {"id": "s13", "label": "PLATEAU_BELT", "lat": 9.15, "lng": 9.35, "radius": 0.55, "threat": 7, "reason": "Central Belt communal flashpoint zone with rugged approaches."},
    {"id": "s14", "label": "BENUE_VALLEY", "lat": 7.75, "lng": 8.75, "radius": 0.55, "threat": 7, "reason": "Seasonal farmer-herder conflict risk along riverine corridors."},
    {"id": "s15", "label": "TARABA_HIGHLANDS", "lat": 7.9, "lng": 10.8, "radius": 0.55, "threat": 6, "reason": "Difficult terrain and intercommunal tensions increase incident potential."},
    {"id": "s16", "label": "NIGER_DELTA_CREEKS", "lat": 4.75, "lng": 6.25, "radius": 0.55, "threat": 7, "reason": "Creek networks elevate piracy, bunkering, and militancy risk."},
    {"id": "s17", "label": "PORT_HARCOURT_RING", "lat": 4.85, "lng": 7.05, "radius": 0.35, "threat": 6, "reason": "Urban and industrial density creates infrastructure vulnerability."},
    {"id": "s18", "label": "LAGOS_LITTORAL", "lat": 6.45, "lng": 3.4, "radius": 0.35, "threat": 5, "reason": "Dense coastal megacity with maritime and civil-disruption exposure."},
    {"id": "s19", "label": "ABUJA_CORE", "lat": 9.08, "lng": 7.49, "radius": 0.3, "threat": 5, "reason": "Capital-region symbolic value and high-profile target concentration."},
    {"id": "s20", "label": "ONITSHA_NEXUS", "lat": 6.15, "lng": 6.78, "radius": 0.35, "threat": 5, "reason": "Commercial transit hub vulnerable to civil unrest and road disruption."},
]

STATE_CENTERS = {
    "Abia": (5.45, 7.52), "Adamawa": (9.33, 12.45), "Akwa Ibom": (5.0, 7.85), "Anambra": (6.22, 6.94),
    "Bauchi": (10.31, 9.84), "Bayelsa": (4.77, 6.08), "Benue": (7.33, 8.74), "Borno": (11.83, 13.15),
    "Cross River": (5.87, 8.6), "Delta": (5.53, 5.9), "Ebonyi": (6.32, 8.12), "Edo": (6.34, 5.62),
    "Ekiti": (7.72, 5.31), "Enugu": (6.45, 7.51), "FCT": (9.08, 7.49), "Gombe": (10.28, 11.17),
    "Imo": (5.48, 7.03), "Jigawa": (12.16, 9.49), "Kaduna": (10.51, 7.42), "Kano": (12.0, 8.59),
    "Katsina": (12.98, 7.62), "Kebbi": (11.49, 4.23), "Kogi": (7.73, 6.69), "Kwara": (8.48, 4.54),
    "Lagos": (6.52, 3.38), "Nasarawa": (8.49, 8.2), "Niger": (9.93, 5.6), "Ogun": (7.0, 3.35),
    "Ondo": (7.1, 5.12), "Osun": (7.56, 4.52), "Oyo": (7.85, 3.93), "Plateau": (9.22, 9.52),
    "Rivers": (4.84, 6.91), "Sokoto": (13.01, 5.25), "Taraba": (8.0, 10.59), "Yobe": (12.0, 11.5),
    "Zamfara": (12.12, 6.22),
}

HIGHWAYS = [
    {"name": "Kaduna-Abuja", "points": ((10.5, 7.4), (9.0, 7.5)), "level": 7, "season": "all"},
    {"name": "Maiduguri-Damaturu", "points": ((11.83, 13.15), (11.75, 11.96)), "level": 8, "season": "dry"},
    {"name": "Sokoto-Gusau", "points": ((13.0, 5.25), (12.17, 6.66)), "level": 6, "season": "dry"},
    {"name": "Benue-Makurdi", "points": ((7.75, 8.75), (7.35, 8.55)), "level": 6, "season": "rainy"},
    {"name": "Delta-Creek", "points": ((4.75, 6.25), (4.85, 7.05)), "level": 6, "season": "rainy"},
]

REGION_BIASES = [
    {"name": "Northeast insurgency belt", "bounds": (10.5, 14.1, 11.0, 14.6), "level": 4, "season": "dry"},
    {"name": "Northwest forest belt", "bounds": (10.0, 13.5, 4.8, 8.3), "level": 3, "season": "dry"},
    {"name": "Central Belt friction zone", "bounds": (6.8, 9.8, 7.0, 10.5), "level": 3, "season": "rainy"},
    {"name": "Niger Delta creek belt", "bounds": (4.0, 5.6, 5.0, 7.7), "level": 4, "season": "rainy"},
]


def clamp(value, low=1, high=10):
    return min(high, max(low, int(round(value))))


def current_season(now):
    # Broad Nigeria seasonal model: rainy season mostly April-October, dry season November-March.
    return "rainy" if 4 <= now.month <= 10 else "dry"


def distance_to_segment(lat, lng, start, end):
    x, y = lat, lng
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.dist((x, y), (x1, y1))
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.dist((x, y), (x1 + t * dx, y1 + t * dy))


def fetch_gemini_calibration(now):
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY not set; using deterministic tactical model only.")
        return {"enabled": False, "model": None, "hotspot_adjustments": {}, "state_adjustments": {}, "reports": []}

    prompt = f"""
You are calibrating a static, non-operational Nigeria security risk demo dataset for a web UI.
Return ONLY compact JSON. Do not include markdown.
Today is {now.date().isoformat()} and the broad season is {current_season(now)}.
Provide cautious, bounded heuristic adjustments, not instructions or targeting guidance.
Schema:
{{
  "hotspot_adjustments": {{"SAMBISA_CORE": 0, "LAKE_CHAD_AXIS": 0}},
  "state_adjustments": {{"Borno": 0, "Zamfara": 0}},
  "reports": [{{"src":"AI_CAL", "c":"short situational summary", "st":"Borno", "l":8}}]
}}
Rules:
- adjustment values must be integers from -1 to 1.
- include at most 10 hotspot adjustments and at most 10 state adjustments.
- include exactly 3 reports, each under 140 characters.
- base the heuristic on broad public factors: seasonality, terrain, corridor vulnerability, and urban density.
""".strip()

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1200,
            "responseMimeType": "application/json",
        },
    }
    request = urllib.request.Request(
        f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            text = response_data["candidates"][0]["content"]["parts"][0]["text"]
            calibration = json.loads(text)
            return normalize_calibration(calibration)
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, json.JSONDecodeError) as error:
            if attempt == 2:
                print(f"Gemini calibration unavailable; falling back to deterministic model: {error}")
                break
            time.sleep(2 ** attempt)

    return {"enabled": False, "model": None, "hotspot_adjustments": {}, "state_adjustments": {}, "reports": []}


def normalize_adjustments(raw_adjustments, allowed_keys):
    adjustments = {}
    if not isinstance(raw_adjustments, dict):
        return adjustments
    for key, value in raw_adjustments.items():
        if key in allowed_keys:
            try:
                adjustments[key] = max(-1, min(1, int(value)))
            except (TypeError, ValueError):
                continue
    return adjustments


def normalize_calibration(raw):
    hotspot_labels = {hotspot["label"] for hotspot in HOTSPOTS}
    states = set(STATE_CENTERS)
    reports = []
    for index, item in enumerate(raw.get("reports", [])[:3], start=1):
        if not isinstance(item, dict):
            continue
        reports.append({
            "id": f"ai{index}",
            "src": str(item.get("src", "AI_CAL"))[:16],
            "c": str(item.get("c", "AI calibration report generated."))[:180],
            "st": str(item.get("st", "National"))[:32],
            "ts": datetime.now(timezone.utc).isoformat(),
            "l": clamp(item.get("l", 5)),
        })
    return {
        "enabled": True,
        "model": GEMINI_MODEL,
        "hotspot_adjustments": normalize_adjustments(raw.get("hotspot_adjustments", {}), hotspot_labels),
        "state_adjustments": normalize_adjustments(raw.get("state_adjustments", {}), states),
        "reports": reports,
    }


def hotspot_threat(hotspot, calibration):
    return clamp(hotspot["threat"] + calibration["hotspot_adjustments"].get(hotspot["label"], 0))


def threat_level(lat, lng, season, calibration):
    level = 1
    for hotspot in HOTSPOTS:
        dist = math.dist((lat, lng), (hotspot["lat"], hotspot["lng"]))
        if dist <= hotspot["radius"]:
            influence = hotspot_threat(hotspot, calibration) - int((dist / hotspot["radius"]) * 4)
            level = max(level, influence)

    for highway in HIGHWAYS:
        corridor_level = highway["level"] + (1 if highway["season"] == season else 0)
        if distance_to_segment(lat, lng, *highway["points"]) <= 0.18:
            level = max(level, corridor_level)

    for bias in REGION_BIASES:
        min_lat, max_lat, min_lng, max_lng = bias["bounds"]
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            level = max(level, bias["level"] + (1 if bias["season"] == season else 0))

    return clamp(level)


def frange(start, stop, step):
    index = 0
    value = start
    while value <= stop + 1e-9:
        yield round(value, 3), index
        index += 1
        value = start + index * step


def weather_for(level, season):
    if season == "rainy":
        return "Heavy Rain Risk" if level >= 7 else "Scattered Storms"
    if level >= 8:
        return "Dusty/Haze"
    if level >= 5:
        return "Dry Heat"
    return "Clear"


def terrain_for(name):
    if name in {"Borno", "Yobe", "Adamawa"}:
        return "Sahel/forest insurgency corridors"
    if name in {"Zamfara", "Kaduna", "Katsina", "Niger"}:
        return "Savanna/forest mix"
    if name in {"Bayelsa", "Delta", "Rivers"}:
        return "Creeks and riverine terrain"
    if name in {"Plateau", "Taraba"}:
        return "Highlands and rugged approaches"
    return "Urban/rural mixed terrain"


def build_grid(season, calibration):
    cells = []
    count = 0
    for lat, row_index in frange(MIN_LAT, MAX_LAT, STEP_LAT):
        stagger = STEP_LNG / 2 if row_index % 2 else 0
        lng = MIN_LNG + stagger
        col_index = 0
        while lng <= MAX_LNG + 1e-9:
            count += 1
            cells.append({
                "id": f"g{count}",
                "lat": round(lat, 3),
                "lng": round(lng, 3),
                "level": threat_level(lat, lng, season, calibration),
                "level": threat_level(lat, lng, season, calibration),
            })
            col_index += 1
            lng = MIN_LNG + stagger + col_index * STEP_LNG
    return cells


def build_states(season, calibration):
    states = []
    sample_offsets = [(0, 0), (0.25, 0), (-0.25, 0), (0, 0.25), (0, -0.25)]
    for name, (lat, lng) in STATE_CENTERS.items():
        sample_levels = [threat_level(lat + d_lat, lng + d_lng, season, calibration) for d_lat, d_lng in sample_offsets]
        level = clamp(sum(sample_levels) / len(sample_levels) + calibration["state_adjustments"].get(name, 0))
        states.append({
            "n": name,
            "l": level,
            "w": weather_for(level, season),
            "t": terrain_for(name),
            "s": f"Predictive watch level {level}/10 for {name}; validate patrol posture against {season}-season mobility and terrain constraints.",
        })
    return states


def build_reports(now, calibration):
    reports = [
        {"id": "r1", "src": "SIGINT", "c": "Anomalous radio traffic detected in Alagarno corridor.", "st": "Borno", "ts": now.isoformat(), "l": 9},
        {"id": "r2", "src": "SAT", "c": "Smoke plume indicators remain elevated around Kuyambana forest sector.", "st": "Zamfara", "ts": now.isoformat(), "l": 8},
        {"id": "r3", "src": "OSINT", "c": "Community reporting indicates increased road-security concern on Abuja-Kaduna axis.", "st": "Kaduna", "ts": now.isoformat(), "l": 7},
    ]
    return calibration["reports"] + reports


def build_database():
    now = datetime.now(timezone.utc)
    season = current_season(now)
    calibration = fetch_gemini_calibration(now)
    grid = build_grid(season, calibration)
    return {
        "meta": {
            "generated_at": now.isoformat(),
            "grid_type": "RECTANGULAR_NATIONAL_PREDICTIVE",
            "point_count": len(grid),
            "season": season,
            "ai_enriched": calibration["enabled"],
            "ai_model": calibration["model"],
        },
        "states": build_states(season, calibration),
        "reports": build_reports(now, calibration),
        "hex_grid": grid,
        "hotspots": [
            {
                "id": hotspot["id"],
                "lat": hotspot["lat"],
                "lng": hotspot["lng"],
                "label": hotspot["label"],
                "threat": hotspot_threat(hotspot, calibration),
                "reason": hotspot["reason"],
            }
            for hotspot in HOTSPOTS
        ],
        "comms_fallback": [
            {"k": ["status", "grid"], "r": f"Grid operational. {len(grid)} national tactical cells currently monitored; AI enrichment: {calibration['enabled']}."},
            {"k": ["borno", "maiduguri"], "r": "ALERT: High insurgent mobility predicted near the Sambisa-Lake Chad axis."},
            {"k": ["kaduna", "highway"], "r": "CAUTION: Abuja-Kaduna highway remains a priority corridor for patrol validation."},
            {"k": ["zamfara", "forest"], "r": "DANGER: Kuyambana and Rugu forest belts remain active risk concentrators."},
            {"k": ["delta", "creek"], "r": "WATCH: Niger Delta creek networks show elevated maritime and infrastructure risk."},
        ],
    }


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(build_database(), file, separators=(",", ":"))
        file.write("\n")
    print(f"Generated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
