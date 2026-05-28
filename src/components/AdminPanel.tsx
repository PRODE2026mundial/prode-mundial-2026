import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Match, Tournament } from "../types";
import { MATCHES } from "../data/matches";
import { ShieldCheck, Key, Save, RefreshCw, XCircle, ChevronRight, Globe, FileJson, Link, Sparkles } from "lucide-react";
import { getCountryFlag } from "../data/flags";

interface AdminPanelProps {
  tournament: Tournament;
  onUpdateSuccess: (updatedResults: Record<string, "1" | "2" | "X" | null>) => void;
  onCancel: () => void;
}

export function AdminPanel({ tournament, onUpdateSuccess, onCancel }: AdminPanelProps) {
  const [adminPassInput, setAdminPassInput] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Results state
  const [selectedJornada, setSelectedJornada] = useState<number>(1);
  const [resultsMap, setResultsMap] = useState<Record<string, "1" | "2" | "X" | null>>(() => {
    const initialMap: Record<string, "1" | "2" | "X" | null> = {};
    MATCHES.forEach((m) => {
      initialMap[m.id] = tournament.results[m.id] !== undefined ? tournament.results[m.id] : null;
    });
    return initialMap;
  });

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Automated results sync states
  const [sourceUrlInput, setSourceUrlInput] = useState(tournament.resultsSourceUrl || "");
  const [savingSourceUrl, setSavingSourceUrl] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [showSamples, setShowSamples] = useState(false);

  const handleSaveSourceUrl = async () => {
    setSavingSourceUrl(true);
    setSyncStatusMsg(null);
    try {
      const docRef = doc(db, "tournaments", tournament.id);
      await updateDoc(docRef, {
        resultsSourceUrl: sourceUrlInput.trim()
      });
      setSyncStatusMsg({ text: "¡Enlace de fuente externa de resultados guardado con éxito!", type: "success" });
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg({ text: "No se pudo almacenar el enlace. Verifica los permisos de base de datos.", type: "error" });
    } finally {
      setSavingSourceUrl(false);
    }
  };

  const handleSyncNow = async () => {
    if (!sourceUrlInput.trim()) {
      setSyncStatusMsg({ text: "Inserta una URL válida primero.", type: "error" });
      return;
    }
    setSavingSourceUrl(true);
    setSyncStatusMsg({ text: "Obteniendo datos de resultados y procesando formato...", type: "info" });
    try {
      const { fetchExternalResults } = await import("../utils/syncResults");
      const report = await fetchExternalResults(sourceUrlInput, MATCHES);
      
      // Update our local state results map
      setResultsMap((prev) => {
        const nextMap = { ...prev };
        Object.entries(report.results).forEach(([matchId, val]) => {
          if (val) {
            nextMap[matchId] = val;
          }
        });
        return nextMap;
      });

      let alertText = `Lectura correcta. Formato: "${
        report.sourceType === "direct" ? "Mapa de ID Directo" : "Lista de Partidos (Fixture)"
      }". Se actualizaron ${report.successCount} resultados de forma local. Recuerda oprimir "Guardar Resultados" para persistirlo para todos los participantes.`;
      
      if (report.unmatchedTeams.length > 0) {
        alertText += ` Equipos no concordados: [${report.unmatchedTeams.slice(0, 3).join(", ")}].`;
      }
      setSyncStatusMsg({ text: alertText, type: "success" });
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg({ 
        text: `No se pudo sincronizar automáticamente: ${err.message || "Error al conectar o formato inválido o CORS block"}`, 
        type: "error" 
      });
    } finally {
      setSavingSourceUrl(false);
    }
  };

  const loadLocalMockUrl = () => {
    const mockUrl = `${window.location.origin}/worldcup-results-test.json`;
    setSourceUrlInput(mockUrl);
    setSyncStatusMsg({ 
      text: "Pre-cargada la URL de prueba de la app. Presiona 'Comenzar Sincronización' para ensayar sus datos.", 
      type: "info" 
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (adminPassInput.trim() === tournament.adminPassword) {
      setIsAdminAuthenticated(true);
    } else {
      setLoginError("Contraseña de administrador incorrecta.");
    }
  };

  const handleSelectResult = (matchId: string, choice: "1" | "2" | "X") => {
    setResultsMap((prev) => ({
      ...prev,
      // toggle or set null if click same
      [matchId]: prev[matchId] === choice ? null : choice
    }));
  };

  const handleClearResult = (matchId: string) => {
    setResultsMap((prev) => ({
      ...prev,
      [matchId]: null
    }));
  };

  const handleSaveResults = async () => {
    setLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const docRef = doc(db, "tournaments", tournament.id);
      
      // Update just the results field
      await updateDoc(docRef, {
        results: resultsMap
      });

      setSaveSuccess(true);
      onUpdateSuccess(resultsMap);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError("No se pudieron guardar los resultados reales. Inténtalo nuevamente.");
      try {
        handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}`);
      } catch (ex) {
        console.error(ex);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentJornadaMatches = MATCHES.filter((m) => m.jornada === selectedJornada);

  if (!isAdminAuthenticated) {
    return (
      <div className="glass p-6 shadow-xl w-full max-w-md mx-auto space-y-6 rounded-2xl" id="admin-auth-panel">
        <div className="text-center" id="admin-auth-header">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-2">
            <Key className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white">Acceso Administrador</h2>
          <p className="text-xs text-slate-400 mt-1">
            Ingresa la contraseña para cargar resultados oficiales y actualizar las puntuaciones.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" id="admin-login-form">
          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium">
              {loginError}
            </div>
          )}

          <div id="admin-pass-field">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
              Contraseña de Administración
            </label>
            <input
              id="admin-pass"
              type="password"
              placeholder="Contraseña establecida al crear el torneo"
              value={adminPassInput}
              onChange={(e) => setAdminPassInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-xs uppercase font-bold tracking-wider rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-xs uppercase font-bold tracking-wider rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
            >
              Verificar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="glass p-5 shadow-xl space-y-6 rounded-2xl" id="admin-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800" id="admin-subheader">
        <div id="admin-desc">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Panel de Resultados Oficiales
          </h2>
          <p className="text-xs text-slate-400 mt-1">Carga quién ganó cada partido para calcular los puntajes.</p>
        </div>

        <div className="flex gap-2" id="admin-top-actions">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded border border-slate-800 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            Salir Administrador
          </button>
          <button
            onClick={handleSaveResults}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {loading ? "Guardando..." : "Guardar Resultados"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg font-semibold animate-pulse">
          ¡Resultados actualizados! La tabla de posiciones se ha recalculado en tiempo real.
        </div>
      )}

      {/* Lectura Automática Section */}
      <div className="p-4 bg-slate-900/60 border border-slate-800/85 rounded-2xl space-y-3" id="admin-autosync-section">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Lectura Automática de Datos (Mundial en Vivo)
          </h3>
          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
            AUTO-SYNC ACTIVO
          </span>
        </div>
        
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Sincroniza los resultados oficiales cargando un archivo JSON externo en tiempo real. Las puntuaciones de todos los participantes se recalculan automáticamente sin necesidad de cargar los partidos a mano.
        </p>

        {syncStatusMsg && (
          <div className={`p-2.5 rounded-lg text-xs font-semibold ${
            syncStatusMsg.type === "success" 
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
              : syncStatusMsg.type === "error"
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
              : "bg-sky-500/10 border border-sky-500/20 text-sky-450"
          }`}>
            {syncStatusMsg.text}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://api.tuservidor.com/resultados.json o Gist"
              value={sourceUrlInput}
              onChange={(e) => setSourceUrlInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleSaveSourceUrl}
                disabled={savingSourceUrl}
                className="px-3 py-1.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                title="Guardar URL"
              >
                {savingSourceUrl ? "Procesando..." : "Guardar Link"}
              </button>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={savingSourceUrl}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] uppercase font-extrabold tracking-wider text-white bg-sky-600 rounded-lg hover:bg-sky-500 hover:shadow-md hover:shadow-sky-500/20 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${savingSourceUrl ? 'animate-spin' : ''}`} />
                Sincronizar Ahora
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px]">
            <button
              type="button"
              onClick={loadLocalMockUrl}
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Probador: Usar URL de prueba del programa
            </button>

            <button
              type="button"
              onClick={() => setShowSamples(!showSamples)}
              className="text-slate-400 hover:text-slate-200 underline transition-colors cursor-pointer"
            >
              {showSamples ? "Cerrar Guía de Formatos" : "Ver Guía de Formatos JSON 📋"}
            </button>
          </div>
        </div>

        {showSamples && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-850/80 font-mono text-[9px] text-slate-400 space-y-2.5 leading-relaxed">
            <h4 className="font-extrabold text-slate-300">Formatos interpretados por el motor de la app:</h4>
            
            <div className="space-y-1">
              <span className="text-sky-400 font-bold">1. Formato Fixture por Goles (Recomendado):</span>
              <p>Puedes subir un array con los nombres de los equipos y sus goles. El sistema asocia los partidos de forma inteligente y calcula los signos (1, X, 2):</p>
              <pre className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-300 overflow-x-auto">
{`[`}
{`  { "team1": "México", "score1": 2, "team2": "Sudáfrica", "score2": 1 },`}
{`  { "homeTeam": "Catar", "homeScore": 0, "awayTeam": "Suiza", "awayScore": 2 }`}
{`]`}
              </pre>
            </div>

            <div className="space-y-1">
              <span className="text-sky-400 font-bold">2. Formato por ID de Partido Directo:</span>
              <p>Un objeto clave-valor mapeando directamente el código del partido con la opción ganadora ("1" para local, "X" para empate, "2" para visitante):</p>
              <pre className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-300 overflow-x-auto">
{`{`}
{`  "j1_m1": "1",`}
{`  "j1_m2": "X",`}
{`  "j1_m3": "2"`}
{`}`}
              </pre>
            </div>
            <p className="text-[8px] text-slate-500">
              *Nota: Puedes pegar tu JSON en servicios como GitHub Gist o Pastebin y usar la URL en la entrada de arriba. Para evadir limitaciones de CORS, el programa usa desvíos de proxy de alta disponibilidad de manera automática.
            </p>
          </div>
        )}
      </div>

      {/* Jornada selection */}
      <div className="flex border-b border-slate-800/80" id="admin-jornada-tabs">
        {[1, 2, 3].map((jNum) => (
          <button
            key={jNum}
            type="button"
            onClick={() => setSelectedJornada(jNum)}
            className={`flex-1 py-2.5 text-xs uppercase font-bold tracking-wider border-b-2 transition-colors cursor-pointer text-center ${
              selectedJornada === jNum
                ? "border-amber-500 text-amber-400 bg-slate-950/20"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Jornada {jNum}
          </button>
        ))}
      </div>

      {/* Match rows for setting options */}
      <div className="space-y-3" id="admin-matches-wrapper">
        <div className="text-xs text-slate-500 font-mono flex justify-between px-2">
          <span>Partido e Info</span>
          <span>Resultado Oficial (Gana - Empate - Gana)</span>
        </div>

        {currentJornadaMatches.map((match) => {
          const currentResult = resultsMap[match.id];
          return (
            <div
              key={match.id}
              className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col gap-2"
            >
              {/* Info banner line */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-1">
                <span>{match.group} • {match.date}</span>
                {currentResult && (
                  <button
                    type="button"
                    onClick={() => handleClearResult(match.id)}
                    className="flex items-center gap-1 text-[9px] text-rose-500 hover:text-rose-400 uppercase font-bold cursor-pointer"
                    title="Limpiar Resultado"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                )}
              </div>

              {/* Main Admin Horizontal Row Layout */}
              <div className="grid grid-cols-12 items-center gap-2 bg-slate-900/30 p-2.5 rounded-xl border border-slate-900">
                {/* Left: Team 1 */}
                <div className="col-span-4 flex items-center justify-end gap-2 text-right min-w-0 pr-1 select-none">
                  <span 
                    className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${
                      currentResult === "1" ? "text-amber-400 font-black" : "text-slate-250"
                    }`}
                    title={match.team1}
                  >
                    {match.team1}
                  </span>
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">
                    {getCountryFlag(match.team1)}
                  </span>
                </div>

                {/* Center: Admin Selection Buttons */}
                <div className="col-span-4 flex items-center justify-center gap-1 shrink-0 px-1 sm:px-2">
                  <button
                    type="button"
                    onClick={() => handleSelectResult(match.id, "1")}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      currentResult === "1"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/25 scale-102"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-250 hover:border-slate-700"
                    }`}
                    title="Gana Local"
                  >
                    GANA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectResult(match.id, "X")}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      currentResult === "X"
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 scale-102"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-250 hover:border-slate-700"
                    }`}
                    title="Empate"
                  >
                    EMPATE
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectResult(match.id, "2")}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      currentResult === "2"
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 scale-102"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-250 hover:border-slate-700"
                    }`}
                    title="Gana Visita"
                  >
                    GANA
                  </button>
                </div>

                {/* Right: Team 2 */}
                <div className="col-span-4 flex items-center justify-start gap-2 text-left min-w-0 pl-1 select-none">
                  <span className="text-lg sm:text-2xl shrink-0 leading-none">
                    {getCountryFlag(match.team2)}
                  </span>
                  <span 
                    className={`text-xs sm:text-sm font-extrabold truncate uppercase tracking-tight ${
                      currentResult === "2" ? "text-amber-400 font-black" : "text-slate-250"
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

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs uppercase font-bold tracking-wider rounded bg-slate-850 hover:bg-slate-800 text-slate-400"
        >
          Cerrar Panel
        </button>
        <button
          onClick={handleSaveResults}
          disabled={loading}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {loading ? "Guardando..." : "Guardar Resultados"}
        </button>
      </div>
    </div>
  );
}
