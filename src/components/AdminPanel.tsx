import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Match, Tournament } from "../types";
import { MATCHES } from "../data/matches";
import { ShieldCheck, Key, Save, RefreshCw, XCircle, Globe, Sparkles } from "lucide-react";
import { getCountryFlag } from "../data/flags";

interface AdminPanelProps {
  tournament: Tournament;
  onUpdateSuccess: (updatedResults: Record<string, "1" | "2" | "X" | null>) => void;
  onCancel: () => void;
  onAdminAuth?: (authenticated: boolean) => void;
}

export function AdminPanel({ tournament, onUpdateSuccess, onCancel, onAdminAuth }: AdminPanelProps) {
  const [adminPassInput, setAdminPassInput] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [selectedJornada, setSelectedJornada] = useState<number>(1);
  const [resultsMap, setResultsMap] = useState<Record<string, "1" | "2" | "X" | null>>(() => {
    const initialMap: Record<string, "1" | "2" | "X" | null> = {};
    MATCHES.forEach((m) => { initialMap[m.id] = tournament.results[m.id] !== undefined ? tournament.results[m.id] : null; });
    return initialMap;
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceUrlInput, setSourceUrlInput] = useState(tournament.resultsSourceUrl || "");
  const [savingSourceUrl, setSavingSourceUrl] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  const handleSaveSourceUrl = async () => {
    setSavingSourceUrl(true);
    setSyncStatusMsg(null);
    try {
      const docRef = doc(db, "tournaments", tournament.id);
      await updateDoc(docRef, { resultsSourceUrl: sourceUrlInput.trim() });
      setSyncStatusMsg({ text: "¡Enlace de fuente externa de resultados guardado con éxito!", type: "success" });
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      setSyncStatusMsg({ text: "No se pudo almacenar el enlace. Verifica los permisos de base de datos.", type: "error" });
    } finally { setSavingSourceUrl(false); }
  };

  const handleSyncNow = async () => {
    if (!sourceUrlInput.trim()) { setSyncStatusMsg({ text: "Inserta una URL válida primero.", type: "error" }); return; }
    setSavingSourceUrl(true);
    setSyncStatusMsg({ text: "Obteniendo datos de resultados y procesando formato...", type: "info" });
    try {
      const { fetchExternalResults } = await import("../utils/syncResults");
      const report = await fetchExternalResults(sourceUrlInput, MATCHES);
      setResultsMap((prev) => {
        const nextMap = { ...prev };
        Object.entries(report.results).forEach(([matchId, val]) => { if (val) nextMap[matchId] = val; });
        return nextMap;
      });
      let alertText = `Lectura correcta. Se actualizaron ${report.successCount} resultados. Presioná "Guardar Resultados" para aplicar.`;
      if (report.unmatchedTeams.length > 0) alertText += ` Equipos no encontrados: [${report.unmatchedTeams.slice(0, 3).join(", ")}].`;
      setSyncStatusMsg({ text: alertText, type: "success" });
    } catch (err: any) {
      setSyncStatusMsg({ text: `No se pudo sincronizar: ${err.message || "Error de conexión o formato inválido"}`, type: "error" });
    } finally { setSavingSourceUrl(false); }
  };

  const loadLocalMockUrl = () => {
    setSourceUrlInput(`${window.location.origin}/worldcup-results-test.json`);
    setSyncStatusMsg({ text: "URL de prueba cargada. Presioná 'Sincronizar Ahora' para probar.", type: "info" });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (adminPassInput.trim() === tournament.adminPassword) {
      setIsAdminAuthenticated(true);
      onAdminAuth?.(true);
    } else {
      setLoginError("Contraseña de administrador incorrecta.");
    }
  };

  const handleSelectResult = (matchId: string, choice: "1" | "2" | "X") => {
    setResultsMap((prev) => ({ ...prev, [matchId]: prev[matchId] === choice ? null : choice }));
  };

  const handleClearResult = (matchId: string) => {
    setResultsMap((prev) => ({ ...prev, [matchId]: null }));
  };

  const handleSaveResults = async () => {
    setLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const docRef = doc(db, "tournaments", tournament.id);
      await updateDoc(docRef, { results: resultsMap });
      setSaveSuccess(true);
      onUpdateSuccess(resultsMap);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError("No se pudieron guardar los resultados. Inténtalo nuevamente.");
      try { handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}`); }
      catch (ex) { console.error(ex); }
    } finally { setLoading(false); }
  };

  const currentJornadaMatches = MATCHES.filter((m) => m.jornada === selectedJornada);

  if (!isAdminAuthenticated) {
    return (
      <div className="glass p-6 shadow-xl w-full max-w-md mx-auto space-y-6 rounded-2xl">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-2">
            <Key className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white">Acceso Administrador</h2>
          <p className="text-xs text-slate-400 mt-1">Ingresá la contraseña para cargar resultados oficiales.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {loginError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium">{loginError}</div>}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Contraseña de Administración</label>
            <input type="password" placeholder="Contraseña establecida al crear el torneo" value={adminPassInput}
              onChange={(e) => setAdminPassInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2 text-xs uppercase font-bold tracking-wider rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 cursor-pointer">Cancelar</button>
            <button type="submit" className="flex-1 py-2 text-xs uppercase font-bold tracking-wider rounded-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer">Verificar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="glass p-5 shadow-xl space-y-6 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Panel de Resultados Oficiales
          </h2>
          <p className="text-xs text-slate-400 mt-1">Cargá quién ganó cada partido para calcular los puntajes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-slate-800 text-slate-400 hover:bg-slate-800/50 transition-colors">Salir</button>
          <button onClick={handleSaveResults} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-colors cursor-pointer">
            <Save className="w-4 h-4" />{loading ? "Guardando..." : "Guardar Resultados"}
          </button>
        </div>
      </div>

      {saveError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{saveError}</div>}
      {saveSuccess && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-semibold animate-pulse">¡Resultados actualizados! La tabla se recalculó en tiempo real.</div>}

      <div className="p-4 bg-slate-900/60 border border-slate-800/85 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />Sincronización Automática
          </h3>
          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">AUTO-SYNC</span>
        </div>
        {syncStatusMsg && (
          <div className={`p-2.5 rounded-lg text-xs font-semibold ${syncStatusMsg.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : syncStatusMsg.type === "error" ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" : "bg-sky-500/10 border border-sky-500/20 text-sky-400"}`}>
            {syncStatusMsg.text}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="url" placeholder="https://gist.githubusercontent.com/.../resultados.json" value={sourceUrlInput}
            onChange={(e) => setSourceUrlInput(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono" />
          <div className="flex gap-1.5">
            <button type="button" onClick={handleSaveSourceUrl} disabled={savingSourceUrl}
              className="px-3 py-1.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 cursor-pointer">
              {savingSourceUrl ? "..." : "Guardar Link"}
            </button>
            <button type="button" onClick={handleSyncNow} disabled={savingSourceUrl}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase font-extrabold tracking-wider text-white bg-sky-600 rounded-lg hover:bg-sky-500 disabled:opacity-50 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${savingSourceUrl ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
          </div>
        </div>
        <div className="flex justify-between font-mono text-[10px]">
          <button type="button" onClick={loadLocalMockUrl} className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" />Usar URL de prueba
          </button>
          <button type="button" onClick={() => setShowSamples(!showSamples)} className="text-slate-400 hover:text-slate-200 underline cursor-pointer">
            {showSamples ? "Cerrar guía" : "Ver formatos JSON 📋"}
          </button>
        </div>
        {showSamples && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-400 space-y-2 leading-relaxed">
            <p className="text-sky-400 font-bold">Formato 1 — Por goles:</p>
            <pre className="p-1.5 bg-slate-900 rounded text-slate-300 overflow-x-auto">{`[{ "team1": "Argentina", "score1": 2, "team2": "Francia", "score2": 1 }]`}</pre>
            <p className="text-sky-400 font-bold">Formato 2 — Por ID directo:</p>
            <pre className="p-1.5 bg-slate-900 rounded text-slate-300 overflow-x-auto">{`{ "j1_m1": "1", "j1_m2": "X", "j1_m3": "2" }`}</pre>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-800/80">
        {[1, 2, 3].map((jNum) => (
          <button key={jNum} type="button" onClick={() => setSelectedJornada(jNum)}
            className={`flex-1 py-2.5 text-xs uppercase font-bold tracking-wider border-b-2 transition-colors cursor-pointer text-center ${selectedJornada === jNum ? "border-amber-500 text-amber-400 bg-slate-950/20" : "border-transparent text-slate-400 hover:text-slate-300"}`}>
            Jornada {jNum}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {currentJornadaMatches.map((match) => {
          const currentResult = resultsMap[match.id];
          return (
            <div key={match.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
                <span>{match.group} • {match.date}</span>
                {currentResult && (
                  <button type="button" onClick={() => handleClearResult(match.id)}
                    className="flex items-center gap-1 text-[9px] text-rose-500 hover:text-rose-400 uppercase font-bold cursor-pointer">
                    <XCircle className="w-3 h-3" /><span>Limpiar</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-12 items-center gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                <div className="col-span-4 flex items-center justify-end gap-2 text-right min-w-0 pr-1 select-none">
                  <span className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${currentResult === "1" ? "text-amber-400" : "text-slate-250"}`}>{match.team1}</span>
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">{getCountryFlag(match.team1)}</span>
                </div>
                <div className="col-span-4 flex items-center justify-center gap-1 shrink-0 px-1 sm:px-2">
                  {(["1", "X", "2"] as const).map((opt) => (
                    <button key={opt} type="button" onClick={() => handleSelectResult(match.id, opt)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${currentResult === opt ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                      {opt === "X" ? "EMP" : "GANA"}
                    </button>
                  ))}
                </div>
                <div className="col-span-4 flex items-center justify-start gap-2 text-left min-w-0 pl-1 select-none">
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">{getCountryFlag(match.team2)}</span>
                  <span className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${currentResult === "2" ? "text-amber-400" : "text-slate-250"}`}>{match.team2}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-xs uppercase font-bold tracking-wider rounded bg-slate-850 hover:bg-slate-800 text-slate-400 cursor-pointer">Cerrar Panel</button>
        <button onClick={handleSaveResults} disabled={loading}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white cursor-pointer">
          <Save className="w-4 h-4" />{loading ? "Guardando..." : "Guardar Resultados"}
        </button>
      </div>
    </div>
  );
}