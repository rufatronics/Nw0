import { GoogleGenAI, Type } from "@google/genai";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, setDoc, doc, getDocs, query, orderBy, limit, serverTimestamp } from "firebase/firestore";

// Using the requested "lite" model
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = "gemini-3.1-flash-lite-preview";

export interface StateThreatData {
  stateName: string;
  threatLevel: number;
  weather: string;
  terrainFactors: string;
  summary: string;
  lastUpdated: any;
}

export interface HeatmapCell {
  lat: number;
  lng: number;
  level: number; // 1-10
}

const NORTHERN_STATES = [
  "Adamawa", "Bauchi", "Benue", "Borno", "Gombe", "Jigawa", "Kaduna", "Kano", "Katsina", 
  "Kebbi", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

// Grouping states into 4 regions to minimize AI calls while covering the 10km grid
const REGIONS = [
  {
    name: "North West",
    states: ["Sokoto", "Kebbi", "Zamfara", "Katsina", "Kano", "Jigawa", "Kaduna"],
    bounds: { minLat: 9.0, maxLat: 14.0, minLng: 3.0, maxLng: 10.0 }
  },
  {
    name: "North East",
    states: ["Borno", "Yobe", "Bauchi", "Gombe", "Adamawa", "Taraba"],
    bounds: { minLat: 7.0, maxLat: 14.0, minLng: 9.0, maxLng: 15.0 }
  },
  {
    name: "North Central West",
    states: ["Niger", "Kwara", "Kogi"],
    bounds: { minLat: 7.0, maxLat: 11.5, minLng: 2.5, maxLng: 7.5 }
  },
  {
    name: "North Central East",
    states: ["Plateau", "Nasarawa", "Benue"],
    bounds: { minLat: 6.5, maxLat: 10.5, minLng: 7.0, maxLng: 11.0 }
  }
];

export async function scrapeAndAnalyzeSecurity() {
  // Check last run time
  const configPath = "systemConfig";
  let configSnap;
  try {
    configSnap = await getDocs(query(collection(db, configPath)));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, configPath);
    return null;
  }
  const lastRunDoc = configSnap.docs.find(d => d.id === "lastRun");
  
  if (lastRunDoc) {
    const lastRun = lastRunDoc.data().timestamp?.toDate();
    if (lastRun) {
      const now = new Date();
      const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      console.log(`Last run was ${diffHours.toFixed(1)} hours ago. (Check disabled for debug)`);
      /*
      if (diffHours < 3) {
        console.log(`Analysis skipped. Last run was ${diffHours.toFixed(1)} hours ago.`);
        return null;
      }
      */
    }
  }

  console.log(`Starting Northern Nigeria Security Analysis Loop using ${MODEL_NAME}...`);
  
  const stateResults: StateThreatData[] = [];
  const heatmapCells: HeatmapCell[] = [];

  // We process by region to optimize AI calls (4 calls instead of 19+)
  for (const region of REGIONS) {
    try {
      console.log(`Analyzing Region: ${region.name}...`);
      
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Analyze the security situation for the ${region.name} region of Nigeria (States: ${region.states.join(", ")}).
        1. Provide a state-level summary for each state.
        2. Generate a comprehensive 10km x 10km grid heatmap for the bounding box: Lat ${region.bounds.minLat} to ${region.bounds.maxLat}, Lng ${region.bounds.minLng} to ${region.bounds.maxLng}.
        For EVERY 0.1 degree cell within this box, assign a threat level (1-10). 
        - Level 1-2: Safe/Stable (Green zones).
        - Level 3-5: Calculated Risk (Yellow/Orange zones).
        - Level 6-10: High/Critical Risk (Red zones).
        Base levels on terrain (forests like Sambisa/Kuyambana, mountains, rivers), current insurgent activity, and mobility.
        Return the data in the specified JSON format. Ensure the heatmap array is complete for the entire bounding box.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              states: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stateName: { type: Type.STRING },
                    threatLevel: { type: Type.NUMBER },
                    weather: { type: Type.STRING },
                    terrainFactors: { type: Type.STRING },
                    summary: { type: Type.STRING }
                  },
                  required: ["stateName", "threatLevel", "weather", "terrainFactors", "summary"]
                }
              },
              heatmap: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                    level: { type: Type.NUMBER }
                  },
                  required: ["lat", "lng", "level"]
                }
              }
            },
            required: ["states", "heatmap"]
          }
        }
      });

      const data = JSON.parse(response.text);
      console.log(`AI Response for ${region.name}:`, data);
      
      if (!data.heatmap || !Array.isArray(data.heatmap)) {
        console.warn(`No heatmap data returned for region ${region.name}`);
        data.heatmap = [];
      }
      
      // Process state results
      for (const stateData of data.states) {
        const threatData: StateThreatData = {
          ...stateData,
          lastUpdated: serverTimestamp()
        };
        const statePath = `stateThreats/${stateData.stateName.toLowerCase()}`;
        try {
          await setDoc(doc(db, "stateThreats", stateData.stateName.toLowerCase()), threatData);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, statePath);
        }
        stateResults.push(threatData);

        // Log Intel Report for each state
        const intelPath = "intelReports";
        try {
          await addDoc(collection(db, intelPath), {
            source: "AI Regional Analysis",
            content: stateData.summary,
            state: stateData.stateName,
            timestamp: serverTimestamp(),
            threatLevel: stateData.threatLevel
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, intelPath);
        }
      }

      const allCells = data.heatmap;
      console.log(`Region ${region.name}: AI returned ${data.heatmap.length} cells, ${allCells.length} passed filter (all cells kept).`);
      heatmapCells.push(...allCells);
      
      // Store regional heatmap chunk
      const heatmapPath = `regionalHeatmaps/${region.name.toLowerCase().replace(/\s+/g, '_')}`;
      try {
        await setDoc(doc(db, "regionalHeatmaps", region.name.toLowerCase().replace(/\s+/g, '_')), {
          region: region.name,
          cells: allCells,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, heatmapPath);
      }

      console.log(`Region ${region.name} analyzed. Generated ${allCells.length} grid cells.`);
    } catch (error) {
      console.error(`Error analyzing region ${region.name}:`, error);
    }
  }

  // Update last run time
  const lastRunPath = "systemConfig/lastRun";
  try {
    await setDoc(doc(db, "systemConfig", "lastRun"), { timestamp: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, lastRunPath);
  }
  
  return stateResults;
}
