import json
import math
from datetime import datetime

# Geospatial AO
MIN_LAT, MAX_LAT = 6.5, 14.0
MIN_LNG, MAX_LNG = 2.5, 14.5
STEP_LAT = 0.12
STEP_LNG = 0.14

# Tactical Hotspots (Lat, Lng, Radius in degrees, base threat)
HOTSPOTS = [
    {"n": "Sambisa", "lat": 11.5, "lng": 13.5, "r": 0.8, "l": 9},
    {"n": "Lake Chad", "lat": 13.6, "lng": 14.1, "r": 0.5, "l": 10},
    {"n": "Alagarno", "lat": 11.8, "lng": 12.8, "r": 0.4, "l": 9},
    {"n": "Kuyambana Forest", "lat": 10.5, "lng": 6.5, "r": 0.7, "l": 8},
    {"n": "Kamuku Forest", "lat": 10.8, "lng": 6.2, "r": 0.5, "l": 8},
    {"n": "Birnin Gwari", "lat": 10.6, "lng": 6.7, "r": 0.4, "l": 9},
    {"n": "Falgore Forest", "lat": 11.0, "lng": 8.6, "r": 0.3, "l": 6},
    {"n": "Mandara Mountains", "lat": 10.8, "lng": 13.3, "r": 0.6, "l": 7},
]

# Highway Corridors (Segmented line checks)
HIGHWAYS = [
    {"n": "Kaduna-Abuja", "p1": (10.5, 7.4), "p2": (9.0, 7.5), "l": 7},
    {"n": "Maiduguri-Damaturu", "p1": (11.8, 13.1), "p2": (11.7, 11.9), "l": 8},
]

def get_threat_level(lat, lng):
    max_l = 1
    # Check hotspots
    for h in HOTSPOTS:
        dist = math.sqrt((lat - h["lat"])**2 + (lng - h["lng"])**2)
        if dist < h["r"]:
            # Inverse linear falloff
            l = int(h["l"] * (1 - (dist / h["r"])))
            max_l = max(max_l, l)
    
    # Check highways (approximate distance to line segment)
    for hw in HIGHWAYS:
        # Very simple point-to-point distance check for brevity
        dist1 = math.sqrt((lat - hw["p1"][0])**2 + (lng - hw["p1"][1])**2)
        dist2 = math.sqrt((lat - hw["p2"][0])**2 + (lng - hw["p2"][1])**2)
        if dist1 < 0.2 or dist2 < 0.2:
            max_l = max(max_l, hw["l"])
            
    # Geographic bias (Northeast is generally higher risk)
    if lat > 11 and lng > 11:
        max_l = max(max_l, 4)
    # Northwest bias
    if lat > 11 and lng < 8:
        max_l = max(max_l, 3)
        
    return min(10, max(1, max_l))

hex_grid = []
count = 0
for r_idx, lat in enumerate([MIN_LAT + i * STEP_LAT for i in range(int((MAX_LAT - MIN_LAT) / STEP_LAT) + 1)]):
    stagger = 0.07 if r_idx % 2 == 1 else 0.0
    for lng in [MIN_LNG + stagger + j * STEP_LNG for j in range(int((MAX_LNG - MIN_LNG) / STEP_LNG) + 1)]:
        if lng > MAX_LNG: continue
        count += 1
        level = get_threat_level(lat, lng)
        hex_grid.append({
            "id": f"h{count}",
            "lat": round(lat, 3),
            "lng": round(lng, 3),
            "l": level
        })

# Map states
STATES = [
    "Adamawa", "Bauchi", "Benue", "Borno", "Gombe", "Jigawa", "Kaduna", "Kano", 
    "Katsina", "Kebbi", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", 
    "Sokoto", "Taraba", "Yobe", "Zamfara"
]

state_data = []
for s in STATES:
    # Estimate threat level based on representative center point
    # Real logic would use polygon clipping, here we use heuristic
    l = 2
    if s in ["Borno", "Yobe"]: l = 8
    if s in ["Zamfara", "Katsina", "Kaduna"]: l = 7
    if s in ["Niger", "Adamawa"]: l = 5
    if s in ["Taraba", "Plateau"]: l = 4
    
    state_data.append({
        "n": s,
        "l": l,
        "w": "Scattered Clouds" if l < 5 else "Dusty/Haze",
        "t": "Hilly terrain" if s == "Plateau" else "Savanna/Forest mix",
        "s": f"High situational awareness required in {s} border zones."
    })

db = {
    "meta": {
        "generated_at": datetime.now().isoformat(),
        "grid_type": "HEXAGONAL_STAGGERED",
        "point_count": len(hex_grid)
    },
    "states": state_data,
    "reports": [
        {"id": "r1", "src": "SIGINT", "c": "Anomalous radio traffic detected in Alagarno corridor.", "st": "Borno", "ts": datetime.now().isoformat(), "l": 9},
        {"id": "r2", "src": "SAT", "c": "Smoke plumes observed in Kuyambana forest sector 4.", "st": "Zamfara", "ts": datetime.now().isoformat(), "l": 7}
    ],
    "hex_grid": hex_grid,
    "comms_fallback": [
        {"k": ["status", "grid"], "r": f"Grid operational. {len(hex_grid)} tactical hexes currently monitored."},
        {"k": ["borno", "maiduguri"], "r": "ALERT: High insurgent mobility reported in Sambisa buffer zones. Avoid nighttime transit."},
        {"k": ["kaduna", "highway"], "r": "CAUTION: Highway patrols increased between KM 40-70 due to kidnapping risks."},
        {"k": ["zamfara", "forest"], "r": "DANGER: Kuyambana and Bagega sectors identified as active bandit staging grounds."}
    ]
}

with open('/src/data/tactical_db.json', 'w') as f:
    json.dump(db, f, separators=(',', ':'))
