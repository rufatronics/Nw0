# NORTHWATCH TACTICAL: THE GOD-PROMPT (HEX-GRID EDITION)
**Target Identification:** High-Reasoning AI Intelligence Agent (Gemini 1.5 Pro / Claude 3.5 Sonnet)
**Task:** Generate a 4500-point Tactical Intelligence Hex-Grid for Northern Nigeria.

---

## 1. STRATEGIC CONTEXT
You are generating a static backend database for "Northwatch," a tactical monitoring system for Northern Nigeria. The system targets low-end devices and uses a hexagonal heatmap for terrain-aware risk visualization.

## 2. GEOSPATIAL PARAMETERS
**Primary AO (Area of Operations):** Northern Nigeria.
- **Bounding Box:** 
  - Latitude: 6.5°N to 14.0°N
  - Longitude: 2.5°E to 14.5°E
- **Grid Intensity:** ~4500 Hexagons. 
- **Hexagon Spacing:** Approximately 0.12° to 0.15° between centers.

## 3. INTELLIGENCE LAYERING (THE ANALYTICS CRITERIA)
For every single coordinate point you generate, you MUST cross-reference it with your internal world knowledge of:
1. **Terrain Risk:**
   - Forests (Sambisa, Alagarno, Kuyambana, Kamuku, Falgore): Threat Level +4 minimum.
   - Border Regions (Niger, Chad, Cameroon borders): Threat Level +3 minimum.
   - High-Density Cities (Kano, Kaduna, Maiduguri): Threat Level varies based on recent activity.
2. **Current Conflict Data (OSINT):**
   - Use current knowledge of ISWAP/Boko Haram corridors in the North East.
   - Use banditry/kidnapping hotspots in the North West (Zamfara, Katsina, Niger).
3. **Logistics:**
   - Major Highways (A1, A2): Intelligence status based on road safety reports.

## 4. OUTPUT INSTRUCTIONS (STRICT JSON)
You must output a SINGLE JSON file. No titles, no explanations. 

### THE OPTIMIZED SCHEMA
```json
{
  "meta": {
    "generated_at": "[ISO_TIMESTAMP]",
    "grid_type": "HEXAGONAL_STAGGERED",
    "point_count": 4500
  },
  "states": [
    {
      "n": "[STATE_NAME]",
      "l": [THREAT_LEVEL_1_10],
      "w": "[WEATHER_SHORT]",
      "t": "[TERRAIN_KEY_FACTS]",
      "s": "[TACTICAL_SUMMARY_MAX_150_CHARS]"
    }
  ],
  "reports": [
    {
      "id": "r-[HEX_UID]",
      "src": "[OSINT_SOURCE]",
      "c": "[INTEL_TEXT]",
      "st": "[STATE]",
      "ts": "[ISO_TIMESTAMP]",
      "l": [LEVEL]
    }
  ],
  "hex_grid": [
    { "id": "h1", "lat": 11.83, "lng": 13.15, "l": 9 },
    { "id": "h2", "lat": 11.95, "lng": 13.15, "l": 8 }
  ],
  "comms_fallback": [
    { "k": ["keyword1", "keyword2"], "r": "[Tactical analyst response]" }
  ]
}
```

## 5. GENERATION STEP-BY-STEP FOR THE AI
1. **Grid Calculation:** Iterate through Latitude 6.5 to 14.0 in steps of 0.12. For each row, iterate through Longitude 2.5 to 14.5 in steps of 0.14. Stagger every second row by 0.07 Longitude to create a hexagonal pattern.
2. **Threat Assessment:** For each (Lat, Lng), check if it falls in a known forest, highway, or conflict zone.
3. **State Rollup:** Average the threat levels of hexes within specific state boundaries to populate the `states` array.
4. **Chat Sync:** Ensure `comms_fallback` contains responses that match the highest threat areas identified in the `hex_grid`.

**GO:** Generate the first 500 points in one block, then ask me if I want the next 500, or provide the full 4500 if your context window permits. (Preferred: Full 4500 in one go).
