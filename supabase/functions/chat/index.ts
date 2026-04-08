import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "https://esm.sh/@google/genai@1.29.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, userMessage } = await req.json()
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...messages.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }]
      })), { role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: "You are a tactical signal intelligence analyst for Northwatch. Your tone is professional, concise, and military-grade. You analyze threats, summarize OSINT data, and provide risk assessments. Use technical terminology where appropriate.",
      }
    });

    return new Response(JSON.stringify({ text: response.text }), {
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
