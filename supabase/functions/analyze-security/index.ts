import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@1.29.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const MODEL_NAME = "gemini-1.5-flash" // User requested 1.5 Flash

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

    console.log("Starting Security Analysis...");

    for (const region of REGIONS) {
      console.log(`Analyzing ${region.name}...`);
      
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

      // Upsert State Threats
      for (const stateData of data.states) {
        await supabase
          .from('state_threats')
          .upsert({
            state_name: stateData.stateName,
            threat_level: stateData.threatLevel,
            weather: stateData.weather,
            terrain_factors: stateData.terrainFactors,
            summary: stateData.summary,
            last_updated: new Date().toISOString()
          }, { onConflict: 'state_name' });

        // Insert Intel Report
        await supabase
          .from('intel_reports')
          .insert({
            source: "AI Regional Analysis",
            content: stateData.summary,
            state: stateData.stateName,
            timestamp: new Date().toISOString(),
            threat_level: stateData.threatLevel
          });
      }

      // Upsert Regional Heatmap
      await supabase
        .from('regional_heatmaps')
        .upsert({
          region_name: region.name,
          cells: data.heatmap,
          last_updated: new Date().toISOString()
        }, { onConflict: 'region_name' });
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
