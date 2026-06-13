import React, { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Prediction, Tournament } from "../types";
import { MATCHES } from "../data/matches";
import { Save, AlertTriangle, CheckCircle, Award, Lock } from "lucide-react";
import { getCountryFlag } from "../data/flags";

interface PredictionFormProps {
  tournament: Tournament;
  existingPrediction: Prediction | null;
  currentUser: User;
  onSaveSuccess: (savedPrediction: Prediction) => void;
  onCancel: () => void;
  allPredictions: Prediction[];
}

// Devuelve true si el partido ya arrancó (su fecha ya pasó)
function isMatchLocked(kickoff: string): boolean {
  const today = new Date();
  const matchDay = new Date(kickoff + "T00:00:00");
  // Bloqueado si el día del partido ya pasó (comparamos solo la fecha)
  return today > matchDay;
}

export function PredictionForm({ tournament, existingPrediction, currentUser, onSaveSuccess, onCancel, allPredictions }: PredictionFormProps) {
  const [selectedJornada, setSelectedJornada] = useState<number>(1);
  const [participantName, setParticipantName] = useState(existingPrediction?.participantName || currentUser.displayName || "");
  const [predictionsMap, setPredictionsMap] = useState<Record<string, "1" | "2" | "X" | "">>(() => {
    const initialMap: Record<string, "1" | "2" | "X" | ""> = {};
    MATCHES.forEach((m) => { initialMap[m.id] = existingPrediction?.predictedResults[m.id] || ""; });
    return initialMap;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (existingPrediction) {
      setParticipantName(existingPrediction.participantName);
      const initialMap: Record<string, "1" | "2" | "X" | ""> = {};
      MATCHES.forEach((m) => { initialMap[m.id] = existingPrediction.predictedResults[m.id] || ""; });
      setPredictionsMap(initialMap);
    }
  }, [existingPrediction]);

  // Seleccionar automáticamente la primera jornada con partidos editables
  useEffect(() => {
    const jornadaConEditable = [1, 2, 3].find((j) =>
      MATCHES.filter((m) => m.jornada === j).some((m) => !isMatchLocked(m.kickoff))
    );
    if (jornadaConEditable) setSelectedJornada(jornadaConEditable);
  }, []);

  const totalMatches = MATCHES.length;
  const completedCount = Object.values(predictionsMap).filter((val) => val !== "").length;
  const progressPercent = Math.round((completedCount / totalMatches) * 100);
  const currentJornadaMatches = MATCHES.filter((m) => m.jornada === selectedJornada);
  const lockedCountInJornada = currentJornadaMatches.filter((m) => isMatchLocked(m.kickoff)).length;

  const handleSelect = (matchId: string, choice: "1" | "2" | "X", locked: boolean) => {
    if (locked) return;
    setPredictionsMap((prev) => ({ ...prev, [matchId]: prev[matchId] === choice ? "" : choice }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const cleanName = participantName.trim();
    if (!cleanName) { setError("Por favor ingresá tu nombre o apodo."); return; }
    if (cleanName.length > 30) { setError("El nombre es demasiado largo (máximo 30 caracteres)."); return; }
    if (!existingPrediction) {
      const nameExists = allPredictions.some((p) => p.participantName.toLowerCase() === cleanName.toLowerCase() && p.userId !== currentUser.uid);
      if (nameExists) { setError(`El nombre "${cleanName}" ya está en uso. Elegí otro.`); return; }
    }
    setLoading(true);
    const predictionId = `u-${currentUser.uid}`;
    try {
      const predictionDocRef = doc(db, "tournaments", tournament.id, "predictions", predictionId);
      await setDoc(predictionDocRef, {
        participantName: cleanName,
        predictedResults: predictionsMap,
        userId: currentUser.uid,
        createdAt: existingPrediction ? existingPrediction.createdAt : serverTimestamp()
      });
      const saved: Prediction = {
        id: predictionId,
        participantName: cleanName,
        predictedResults: predictionsMap,
        createdAt: existingPrediction?.createdAt || new Date(),
        userId: currentUser.uid
      };
      setSuccess("¡Tu prode se guardó correctamente!");
      setTimeout(() => { onSaveSuccess(saved); }, 1500);
    } catch (err) {
      setError("No se pudo guardar tu prode. Revisá tu conexión.");
      try { handleFirestoreError(err, OperationType.CREATE, `tournaments/${tournament.id}/predictions/${predictionId}`); }
      catch (ex) { console.error(ex); }
    } finally { setLoading(false); }
  };

  return (
    <div className="glass p-5 shadow-xl space-y-6 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-sky-400" />
            {existingPrediction ? "Editar mi Prode" : "Cargar mi Prode"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Los partidos ya iniciados están bloqueados 🔒</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Progreso</div>
            <div className="text-xs text-sky-400 font-mono font-bold">{completedCount} / {totalMatches}</div>
          </div>
          <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
        {success && <div className="p-3.5 bg-sky-500/15 border border-sky-500/20 text-sky-400 text-xs rounded-lg flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" /><span>{success}</span></div>}

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Tu nombre / Apodo <span className="text-sky-400">*</span></label>
          <input type="text" required placeholder="Ej. Tío Carlos, Pedro, Gabi" value={participantName}
            onChange={(e) => setParticipantName(e.target.value)} disabled={loading || !!existingPrediction}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-75 disabled:cursor-not-allowed" />
          {existingPrediction && <p className="text-[10px] text-slate-500 mt-1">Registrado como "{existingPrediction.participantName}".</p>}
        </div>

        {/* Tabs de jornada */}
        <div className="flex border-b border-slate-800/80">
          {[1, 2, 3].map((jNum) => {
            const jornadaMatches = MATCHES.filter((m) => m.jornada === jNum);
            const allLocked = jornadaMatches.every((m) => isMatchLocked(m.kickoff));
            return (
              <button key={jNum} type="button" onClick={() => setSelectedJornada(jNum)}
                className={`flex-1 py-2.5 text-xs uppercase font-bold tracking-wider border-b-2 transition-colors cursor-pointer text-center flex items-center justify-center gap-1 ${selectedJornada === jNum ? "border-sky-500 text-sky-400 bg-slate-950/20" : "border-transparent text-slate-400 hover:text-slate-300"}`}>
                {allLocked && <Lock className="w-3 h-3" />}
                Jornada {jNum}
              </button>
            );
          })}
        </div>

        {/* Aviso si hay partidos bloqueados en la jornada */}
        {lockedCountInJornada > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span><strong className="text-amber-400">{lockedCountInJornada} partido{lockedCountInJornada > 1 ? "s" : ""}</strong> de esta jornada ya comenzaron y no se pueden modificar.</span>
          </div>
        )}

        <div className="space-y-3">
          {currentJornadaMatches.map((match) => {
            const currentChoice = predictionsMap[match.id];
            const realResult = tournament.results[match.id];
            const hasRealResult = realResult !== undefined && realResult !== null;
            const isPredictionCorrect = hasRealResult && currentChoice === realResult;
            const locked = isMatchLocked(match.kickoff);

            return (
              <div key={match.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition-colors ${locked ? "bg-slate-900/40 border-slate-800/40 opacity-75" : "bg-slate-950 border-slate-800/80 hover:border-slate-700"}`}>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
                  <span className="flex items-center gap-1">
                    {locked && <Lock className="w-3 h-3 text-amber-600" />}
                    {match.group} • {match.date}
                  </span>
                  {hasRealResult && (
                    <div className="flex items-center gap-1.5">
                      <span className="bg-slate-900 border border-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">
                        {realResult === "1" ? "Gana Local" : realResult === "2" ? "Gana Visita" : "Empate"}
                      </span>
                      {currentChoice && (isPredictionCorrect
                        ? <span className="bg-sky-500/10 text-sky-400 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-sky-500/20">+1 PTS</span>
                        : <span className="bg-rose-500/10 text-rose-400 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-rose-500/20">0 PTS</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-12 items-center gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                  <div className="col-span-4 flex items-center justify-end gap-2 text-right min-w-0 pr-1 select-none">
                    <span className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${currentChoice === "1" ? "text-sky-400" : "text-slate-250"}`}>{match.team1}</span>
                    <span className="text-lg sm:text-2xl shrink-0 leading-none">{getCountryFlag(match.team1)}</span>
                  </div>
                  <div className="col-span-4 flex items-center justify-center gap-1 shrink-0 px-1 sm:px-2">
                    {(["1", "X", "2"] as const).map((opt) => (
                      <button key={opt} type="button"
                        onClick={() => handleSelect(match.id, opt, locked)}
                        disabled={locked}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-wider transition-all border ${
                          locked
                            ? "cursor-not-allowed opacity-50 bg-slate-900 border-slate-800 text-slate-600"
                            : currentChoice === opt
                            ? "cursor-pointer bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/25"
                            : "cursor-pointer bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}>
                        {opt === "X" ? "EMPATE" : "GANA"}
                      </button>
                    ))}
                  </div>
                  <div className="col-span-4 flex items-center justify-start gap-2 text-left min-w-0 pl-1 select-none">
                    <span className="text-lg sm:text-2xl shrink-0 leading-none">{getCountryFlag(match.team2)}</span>
                    <span className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${currentChoice === "2" ? "text-sky-400" : "text-slate-250"}`}>{match.team2}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-slate-950 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400">Completaste <strong>{completedCount}</strong> de <strong>{totalMatches}</strong> partidos.</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={onCancel} className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-350 text-xs uppercase font-bold tracking-wider cursor-pointer">Cerrar</button>
            <button type="submit" disabled={loading} className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs uppercase font-bold tracking-wider rounded-lg shadow-lg shadow-sky-500/30 cursor-pointer">
              <Save className="w-4 h-4" />{loading ? "Guardando..." : "Guardar Prode"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}