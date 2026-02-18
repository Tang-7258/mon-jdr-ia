"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function JDRGame() {
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [stats, setStats] = useState({ pv: 100, credits: 500, energie: 100 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (data) {
        setMessages(data);
        const lastAiMsg = [...data].reverse().find(m => m.is_ai && m.stats_json);
        if (lastAiMsg) setStats(lastAiMsg.stats_json);
      }
    };
    fetchMessages();

    const channel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
      (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        if (payload.new.is_ai && payload.new.stats_json) setStats(payload.new.stats_json);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendMessage = async () => {
    if (!input || !playerName || loading) return;
    setLoading(true);
    
    // 1. Envoyer l'action du joueur à Supabase
    await supabase.from('messages').insert([
      { player_name: playerName, content: input, is_ai: false }
    ]);

    // 2. Appeler l'IA pour générer la suite
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input, playerName, currentStats: stats }),
      });
    } catch (e) {
      console.error("Erreur IA:", e);
    }

    setInput('');
    setLoading(false);
  };

  if (!isClient) return null;

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 p-4 font-mono">
      <div className="flex justify-around border-b border-green-900 pb-4 mb-4 text-xl bg-zinc-900/50 p-2 rounded">
        <div className="flex flex-col items-center"><span>❤️ PV</span><span className="text-white">{stats.pv}</span></div>
        <div className="flex flex-col items-center"><span>💰 CREDITS</span><span className="text-white">{stats.credits}</span></div>
        <div className="flex flex-col items-center"><span>⚡ ENERGIE</span><span className="text-white">{stats.energie}</span></div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 bg-zinc-950 rounded border border-green-900">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-lg border ${m.is_ai ? "bg-blue-900/10 border-blue-900 text-blue-300" : "bg-green-900/10 border-green-900 text-green-200 ml-8"}`}>
            <span className="font-bold uppercase text-[10px] block mb-1 opacity-70">
               {m.is_ai ? "🤖 SYSTÈME MJ" : `👤 ${m.player_name}`}
            </span>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-blue-500 animate-pulse text-sm italic">Le Maître du Jeu analyse votre action...</div>}
      </div>

      <div className="flex gap-2 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
        <input 
          className="bg-black border border-green-900 p-2 w-32 rounded outline-none focus:border-green-400 text-sm"
          placeholder="Pseudo"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input 
          className="bg-black border border-green-900 p-2 flex-1 rounded outline-none focus:border-green-400 text-sm"
          placeholder={loading ? "Attente du MJ..." : "Décrivez votre action..."}
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button 
          onClick={sendMessage} 
          disabled={loading}
          className={`px-6 rounded font-bold transition-all ${loading ? "bg-zinc-700 text-zinc-500" : "bg-green-600 text-black hover:bg-green-400"}`}
        >
          {loading ? "..." : "EXECUTER"}
        </button>
      </div>
    </div>
  );
}