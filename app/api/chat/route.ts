import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { content, playerName, currentStats } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Tu es le Maître du Jeu d'un JDR Cyberpunk immersif. 
    Action de ${playerName} : "${content}".
    Stats actuelles : ${JSON.stringify(currentStats)}.

    Réponds EXCLUSIVEMENT sous ce format JSON (pas de texte avant ou après) :
    {
      "narration": "Ta réponse narrative ici (courte et intense)",
      "newStats": { "pv": valeur, "credits": valeur, "energie": valeur }
    }

    Règle : L'énergie baisse de 5 à chaque action physique. Les crédits varient selon les fouilles. Si PV = 0, le joueur meurt.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/gi, "").trim();
    const response = JSON.parse(cleanJson);

    await supabase.from('messages').insert([
      { 
        player_name: "MJ", 
        content: response.narration, 
        is_ai: true, 
        stats_json: response.newStats 
      }
    ]);

    return NextResponse.json(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}