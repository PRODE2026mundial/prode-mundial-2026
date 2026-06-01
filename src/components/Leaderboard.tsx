import { Prediction, Tournament } from "../types";
import { MATCHES } from "../data/matches";
import { Medal, Search, TrendingUp, HelpCircle } from "lucide-react";
import React, { useState, useMemo } from "react";

interface LeaderboardProps {
  predictions: Prediction[];
  tournament: Tournament;
  onSelectParticipant: (participantName: string, predictedResults: Record<string, "1" | "2" | "X" | "">) => void;
  currentUserPrediction: Prediction | null;
  currentUserId: string;
}

export function Leaderboard({ predictions, tournament, onSelectParticipant, currentUserPrediction, currentUserId }: LeaderboardProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const leaderboardData = useMemo(() => {
    return predictions.map((pred) => {
      let points = 0;
      let totalPredicted = 0;
      let hits = 0;
      MATCHES.forEach((match) => {
        const prediction = pred.predictedResults[match.id];
        const actualResult = tournament.results[match.id];
        if (prediction) {
          totalPredicted++;
          if (actualResult && prediction === actualResult) {
            points += 1;
            hits += 1;
          }
        }
      });
      return {
        participantName: pred.participantName,
        points,
        totalPredicted,
        hits,
        predictedResults: pred.predictedResults,
        userId: pred.userId,
      };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.participantName.localeCompare(b.participantName);
    });
  }, [predictions, tournament.results]);

  const filteredData = leaderboardData.filter((row) =>
    row.participantName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass p-5 shadow-xl space-y-4 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Tabla de Posiciones</h2>
          </div>
          <p className="text-xs text-slate-400">Puntos acumulados en tiempo real (1 punto por acierto).</p>
        </div>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
          />
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          No hay participantes todavía.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-3 w-12 text-center">Pos</th>
                <th className="py-2.5">Participante</th>
                <th className="py-2.5 text-center w-16 font-mono text-xs">Puntos</th>
                <th className="py-2.5 text-center w-20 font-mono text-xs hidden sm:table-cell">Aciertos</th>
                <th className="py-2.5 text-center w-24 font-mono text-xs hidden sm:table-cell">Pronósticos</th>
                <th className="py-2.5 text-right pr-3 w-28">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => {
                const isCurrentUser = row.userId === currentUserId;
                const position = index + 1;
                let posColor = "text-slate-400";
                if (position === 1) posColor = "text-yellow-400 font-bold";
                else if (position === 2) posColor = "text-slate-300 font-bold";
                else if (position === 3) posColor = "text-amber-600 font-bold";
                const rowBg = isCurrentUser ? "bg-sky-500/5 hover:bg-sky-500/10 border-l-2 border-l-sky-500" : "hover:bg-slate-800/30";

                return (
                  <tr key={row.participantName} className={`border-b border-slate-800/40 text-sm transition-colors ${rowBg}`}>
                    <td className="py-3 pl-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${posColor}`}>
                        {position === 1 ? <Medal className="w-3.5 h-3.5" /> : position}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span>{row.participantName}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Tú</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-sky-400 font-mono text-base">{row.points}</td>
                    <td className="py-3 text-center text-slate-300 font-mono text-xs hidden sm:table-cell">{row.hits}</td>
                    <td className="py-3 text-center text-slate-400 font-mono text-xs hidden sm:table-cell">{row.totalPredicted} / {MATCHES.length}</td>
                    <td className="py-3 text-right pr-3">
                      <button
                        onClick={() => onSelectParticipant(row.participantName, row.predictedResults)}
                        className="text-xs py-1 px-2.5 rounded bg-slate-850 hover:bg-slate-700 text-slate-300 transition-colors uppercase font-bold tracking-wider cursor-pointer"
                      >
                        Ver Prode
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}