import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Force Vercel à ne pas mettre cette route en cache
export const dynamic = 'force-dynamic';

// Initialisation des clients avec tes clés secrètes
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { content, playerName, currentStats } = await req.json();
    
    // Sélection du modèle Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Le Prompt : Les instructions pour l'IA
    const prompt = `Tu es le Maître du Jeu d'un JDR Cyberpunk immersif, sombre et technologique. 
    Action du joueur (${playerName}) : "${content}".
    Stats actuelles du joueur : ${JSON.stringify(currentStats)}.

    Réponds EXCLUSIVEMENT sous ce format JSON strict (pas de texte avant ou après) :
    {
      "narration": "Ta réponse narrative ici (courte, maximum 3 phrases, style cyberpunk)",
      "newStats": { "pv": valeur_numérique, "credits": valeur_numérique, "energie": valeur_numérique }
    }

    Règles de jeu : 
    - L'énergie baisse de 5 à chaque action physique ou combat.
    - Les crédits augmentent si le joueur fouille ou réussit une mission, baissent s'il achète.
    - Les PV baissent si l'action est risquée ou échoue.
    - Si PV = 0, annonce la mort de manière dramatique.`;

    // Génération de la réponse par l'IA
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Nettoyage de la réponse pour extraire le JSON
    const cleanJson = text.replace(/```json|```/gi, "").trim();
    const aiResponse = JSON.parse(cleanJson);

    // Enregistrement de la réponse du MJ dans Supabase
    const { error: supabaseError } = await supabase.from('messages').insert([
      { 
        player_name: "MJ", 
        content: aiResponse.narration, 
        is_ai: true, 
        stats_json: aiResponse.newStats 
      }
    ]);

    if (supabaseError) throw supabaseError;

    // Renvoi de la réponse au front-end
    return NextResponse.json(aiResponse);

  } catch (error) {
    console.error("Erreur API Chat:", error);
    return NextResponse.json(
      { error: "Le Maître du Jeu a eu un court-circuit cérébral." }, 
      { status: 500 }
    );
  }
}