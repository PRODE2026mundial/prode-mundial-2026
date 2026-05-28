import React, { useState } from "react";
import { Match, Tournament } from "../types";
import { MATCHES } from "../data/matches";
import { X, Award, CheckCircle2, AlertCircle } from "lucide-react";
import { getCountryFlag } from "../data/flags";

interface ParticipantPredictionsViewProps {
  participantName: string;
  predictedResults: Record<string, "1" | "2" | "X" | "">;
  tournament: Tournament;
  onClose: () => void;
}

export function ParticipantPredictionsView({
  participantName,
  predictedResults,
  tournament,
  onClose
}: ParticipantPredictionsViewProps) {
  const [selectedJornada, setSelectedJornada] = useState<number>(1);

  const currentJornadaMatches = MATCHES.filter((m) => m.jornada === selectedJornada);

  // Statistics
  let hits = 0;
  let matchesWithResult = 0;
  let matchesPredicted = 0;

  MATCHES.forEach((match) => {
    const predictor = predictedResults[match.id];
    const actualResult = tournament.results[match.id];

    if (predictor) {
      matchesPredicted++;
      if (actualResult && actualResult !== null) {
        matchesWithResult++;
        if (predictor === actualResult) {
          hits++;
        }
      }
    }
  });

  return (
    <div className="glass p-5 shadow-2xl space-y-5 rounded-2xl" id="participant-view-card">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800" id="participant-view-header">
        <div id="participant-view-title-group">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Prode de {participantName}</h3>
          </div>
          <p className="text-xs text-slate-400">Detalles de predicciones y aciertos acumulados.</p>
        </div>
        <button
          onClick={onClose}
          id="btn-close-view"
          className="p-1 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800" id="participant-view-stats">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Puntos Totales</div>
          <div className="text-xl font-extrabold text-sky-400 font-mono mt-1">{hits}</div>
        </div>
        <div className="text-center border-x border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Efectividad</div>
          <div className="text-xl font-extrabold text-slate-200 font-mono mt-1">
            {matchesWithResult > 0 ? `${Math.round((hits / matchesWithResult) * 100)}%` : "0%"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Pronosticados</div>
          <div className="text-xl font-extrabold text-sky-400 font-mono mt-1">
            {matchesPredicted} / {MATCHES.length}
          </div>
        </div>
      </div>

      {/* Jornada Tabs Navigation */}
      <div className="flex border-b border-slate-800/80" id="view-jornada-tabs">
        {[1, 2, 3].map((jNum) => (
          <button
            key={jNum}
            type="button"
            id={`tab-view-j}-jornada-${jNum}`}
            onClick={() => setSelectedJornada(jNum)}
            className={`flex-1 py-1.5 text-xs uppercase font-bold tracking-wider border-b-2 transition-colors cursor-pointer text-center ${
              selectedJornada === jNum
                ? "border-sky-500 text-sky-400 bg-slate-950/20"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Jornada {jNum}
          </button>
        ))}
      </div>

      {/* Matches predictions list */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1" id="view-matches-list">
        {currentJornadaMatches.map((match) => {
          const prediction = predictedResults[match.id];
          const actualResult = tournament.results[match.id];
          const hasPrediction = !!prediction;
          const hasActualResult = actualResult && actualResult !== null;
          const isCorrect = hasPrediction && hasActualResult && prediction === actualResult;

          return (
            <div
              key={match.id}
              className="p-3 bg-slate-950/60 border border-slate-800/85 rounded-xl flex flex-col gap-2"
            >
              {/* Info top banner inside item */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
                <span>{match.group} • {match.date}</span>
                <div className="flex items-center gap-1.5">
                  {hasActualResult && (
                    <>
                      <span className="text-slate-500">Oficial:</span>
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">
                        {actualResult === "1" ? "Gana Local" : actualResult === "2" ? "Gana Visita" : "Empate"}
                      </span>
                    </>
                  )}
                  {hasActualResult && hasPrediction && (
                    <span className="ml-1 pl-1 border-l border-slate-800/80">
                      {isCorrect ? (
                        <span className="bg-sky-500/15 text-sky-450 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-sky-500/20 shadow-sm">+1 PTS</span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-450 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-rose-500/20">0 PTS</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Read-Only Prediction Horizontal View */}
              <div className="grid grid-cols-12 items-center gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                {/* Left: Team 1 */}
                <div className="col-span-4 flex items-center justify-end gap-2 text-right min-w-0 pr-1 select-none">
                  <span 
                    className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${
                      prediction === "1" ? "text-sky-450 font-black" : "text-slate-250"
                    }`}
                    title={match.team1}
                  >
                    {match.team1}
                  </span>
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">
                    {getCountryFlag(match.team1)}
                  </span>
                </div>

                {/* Center: Selected display */}
                <div className="col-span-4 flex items-center justify-center gap-1 shrink-0 px-1 sm:px-2">
                  <div
                    className={`flex-1 py-1 text-center rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider border select-none transition-all ${
                      prediction === "1"
                        ? "bg-sky-500 text-slate-950 border-sky-400 font-black shadow-md shadow-sky-500/25 scale-102"
                        : "bg-slate-900/40 border-slate-850/60 text-slate-650"
                    }`}
                  >
                    GANA
                  </div>
                  <div
                    className={`flex-1 py-1 text-center rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider border select-none transition-all ${
                      prediction === "X"
                        ? "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/25 scale-102"
                        : "bg-slate-900/40 border-slate-850/60 text-slate-650"
                    }`}
                  >
                    EMPATE
                  </div>
                  <div
                    className={`flex-1 py-1 text-center rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider border select-none transition-all ${
                      prediction === "2"
                        ? "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/25 scale-102"
                        : "bg-slate-900/40 border-slate-850/60 text-slate-650"
                    }`}
                  >
                    GANA
                  </div>
                </div>

                {/* Right: Team 2 */}
                <div className="col-span-4 flex items-center justify-start gap-2 text-left min-w-0 pl-1 select-none">
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">
                    {getCountryFlag(match.team2)}
                  </span>
                  <span 
                    className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${
                      prediction === "2" ? "text-sky-400 font-black" : "text-slate-250"
                    }`}
                    title={match.team2}
                  >
                    {match.team2}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          id="btn-close-view-footer"
          className="w-full sm:w-auto py-2 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs uppercase font-bold tracking-wider transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
