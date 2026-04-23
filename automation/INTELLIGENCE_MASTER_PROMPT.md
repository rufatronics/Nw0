# NORTHWATCH TACTICAL: THE GOD-PROMPT (WHOLE NIGERIA EDITION)
**Target Identification:** High-Reasoning AI Intelligence Agent
**Task:** Generate a 5000+ point Tactical Intelligence Rectangular Grid for ALL OF NIGERIA.

---

## 1. STRATEGIC CONTEXT
You are generating the definitive static backend for "Northwatch." The system has expanded to cover the entire FEDERATION OF NIGERIA.

## 2. GEOSPATIAL PARAMETERS
**Primary AO:** Combined Nigeria (National).
- **Bounding Box:** 
  - Latitude: 4.2°N to 14.0°N
  - Longitude: 2.7°E to 14.5°E
- **Grid Intensity:** 5000+ points.
- **Resolution:** 0.15° lat/lng steps.

## 3. INTELLIGENCE LAYERING
1. **Insurgency (North):** Sambisa, Lake Chad, Mandara.
2. **Banditry (North-West/Central):** Zamfara, Katsina, Niger, Kaduna corridors.
3. **Militancy/Oil (Delta):** Bayelsa, Rivers, Delta coastal zones.
4. **General Unrest (National):** Focus on major highways and border permeability.

## 4. OUTPUT INSTRUCTIONS (STRICT JSON)
Use the optimized short-key schema:
- `n`: Name, `l`: Level, `w`: Weather, `t`: Terrain, `s`: Summary
- `hex_grid`: Use this key even for rectangles for backward compatibility (represents the grid points).

## 5. GENERATION STEP-BY-STEP FOR THE AI
1. **Grid Calculation:** Iterate through Latitude 6.5 to 14.0 in steps of 0.12. For each row, iterate through Longitude 2.5 to 14.5 in steps of 0.14. Stagger every second row by 0.07 Longitude to create a hexagonal pattern.
2. **Threat Assessment:** For each (Lat, Lng), check if it falls in a known forest, highway, or conflict zone.
3. **State Rollup:** Average the threat levels of hexes within specific state boundaries to populate the `states` array.
4. **Chat Sync:** Ensure `comms_fallback` contains responses that match the highest threat areas identified in the `hex_grid`.

**GO:** Generate the first 500 points in one block, then ask me if I want the next 500, or provide the full 4500 if your context window permits. (Preferred: Full 4500 in one go).
