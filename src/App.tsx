import React, { useState, useEffect } from "react";
import { doc, collection, onSnapshot, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import { Tournament, Prediction } from "./types";
import { TournamentInit } from "./components/TournamentInit";
import { Leaderboard } from "./components/Leaderboard";
import { PredictionForm } from "./components/PredictionForm";
import { AdminPanel } from "./components/AdminPanel";
import { ParticipantPredictionsView } from "./components/ParticipantPredictionsView";
import { AuthScreen } from "./components/AuthScreen";
import { Trophy, LogOut, Plus, Shield, Share2, Check, Sparkles, Globe } from "lucide-react";
import { MATCHES } from "./data/matches";
import { fetchExternalResults } from "./utils/syncResults";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialTourneyId, setInitialTourneyId] = useState<string | null>(null);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState<string | null>(null);
  const [showPredictionForm, setShowPredictionForm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    name: string;
    predictedResults: Record<string, "1" | "2" | "X" | "">;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlTId = queryParams.get("t");
    if (urlTId) setInitialTourneyId(urlTId);
  }, []);

  useEffect(() => {
    if (!activeTournament) { setPredictions([]); return; }
    setLoading(true);
    const tournamentDocRef = doc(db, "tournaments", activeTournament.id);
    const unsubscribeTournament = onSnapshot(tournamentDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setActiveTournament((prev) => {
            if (!prev) return null;
            return { ...prev, name: data.name, results: data.results || {}, resultsSourceUrl: data.resultsSourceUrl || "", accessPassword: data.accessPassword, adminPassword: data.adminPassword };
          });
        }
      },
      (error) => { try { handleFirestoreError(error, OperationType.GET, `tournaments/${activeTournament.id}`); } catch (ex) { console.error(ex); } }
    );
    const predictionsCollRef = collection(db, "tournaments", activeTournament.id, "predictions");
    const unsubscribePredictions = onSnapshot(predictionsCollRef,
      (querySnap) => {
        const loaded: Prediction[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          loaded.push({ id: docSnap.id, participantName: data.participantName, predictedResults: data.predictedResults || {}, createdAt: data.createdAt, userId: data.userId || null });
        });
        setPredictions(loaded);
        setLoading(false);
      },
      (error) => { try { handleFirestoreError(error, OperationType.LIST, `tournaments/${activeTournament.id}/predictions`); } catch (ex) { console.error(ex); } setLoading(false); }
    );
    return () => { unsubscribeTournament(); unsubscribePredictions(); };
  }, [activeTournament?.id]);

  useEffect(() => {
    if (!activeTournament || !activeTournament.resultsSourceUrl) { setBackgroundSyncMessage(null); return; }
    const runAutomatedSync = async () => {
      setIsBackgroundSyncing(true);
      setBackgroundSyncMessage("Leyendo resultados en vivo...");
      try {
        const report = await fetchExternalResults(activeTournament.resultsSourceUrl!, MATCHES);
        let hasNewUpdates = false;
        const currentResults = { ...activeTournament.results };
        Object.entries(report.results).forEach(([matchId, val]) => {
          if (val && activeTournament.results[matchId] !== val) { currentResults[matchId] = val; hasNewUpdates = true; }
        });
        if (hasNewUpdates) {
          const docRef = doc(db, "tournaments", activeTournament.id);
          await updateDoc(docRef, { results: currentResults });
          setBackgroundSyncMessage("¡Posiciones actualizadas automáticamente!");
        } else {
          setBackgroundSyncMessage("Resultados actualizados.");
        }
        setTimeout(() => setBackgroundSyncMessage(null), 6000);
      } catch (err: any) {
        setBackgroundSyncMessage("Sincronización en vivo disponible.");
        setTimeout(() => setBackgroundSyncMessage(null), 5000);
      } finally { setIsBackgroundSyncing(false); }
    };
    runAutomatedSync();
    const syncInterval = setInterval(runAutomatedSync, 240000);
    return () => clearInterval(syncInterval);
  }, [activeTournament?.id, activeTournament?.resultsSourceUrl]);

  const currentUserPrediction = React.useMemo(() => {
    if (!activeTournament || !user) return null;
    return predictions.find((p) => p.userId === user.uid) || null;
  }, [predictions, activeTournament?.id, user?.uid]);

  const handleSelectTournament = (tournament: Tournament) => {
    setActiveTournament(tournament);
    window.history.pushState({}, "", `${window.location.origin}?t=${tournament.id}`);
  };

  const handleExitTournament = () => {
    setActiveTournament(null);
    setShowPredictionForm(false);
    setShowAdminPanel(false);
    setSelectedParticipant(null);
    window.history.pushState({}, "", window.location.origin);
  };

  const copyShareLink = () => {
    if (activeTournament) {
      navigator.clipboard.writeText(`${window.location.origin}?t=${activeTournament.id}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSignOut = async () => { handleExitTournament(); await signOut(auth); };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur sticky top-0 z-40 px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleExitTournament}>
            <Trophy className="w-6 h-6 text-sky-400" />
            <span className="font-extrabold tracking-tight text-white text-lg">Prode Mundial 2026</span>
          </div>
          <div className="flex items-center gap-2">
            {activeTournament && (
              <button onClick={copyShareLink} className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded text-xs bg-slate-800 hover:bg-slate-700 font-medium text-slate-300 transition-colors cursor-pointer">
                {copiedLink ? <><Check className="w-3.5 h-3.5 text-sky-400" /> ¡Copiado!</> : <><Share2 className="w-3.5 h-3.5" /> Compartir</>}
              </button>
            )}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[150px]">{user.displayName || user.email}</span>
              <button onClick={handleSignOut} className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center py-8 px-4 max-w-7xl w-full mx-auto">
        {!activeTournament ? (
          <div className="w-full flex flex-col items-center justify-center py-6">
            <TournamentInit onSelectTournament={handleSelectTournament} initialTournamentId={initialTourneyId} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-5 glass rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg">
              <div className="space-y-1.5">
                <span className="text-[10px] bg-sky-500/15 text-sky-400 font-extrabold tracking-widest uppercase py-0.5 px-2 rounded-full border border-sky-500/20">Torneo Activo</span>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{activeTournament.name}</h2>
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs text-slate-400 font-mono">
                  <span>ID: <strong className="text-sky-400">{activeTournament.id}</strong></span>
                  <span>•</span>
                  <span>Participantes: <strong className="text-white">{predictions.length}</strong></span>
                  {activeTournament.resultsSourceUrl && (
                    <><span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Globe className={`w-3.5 h-3.5 ${isBackgroundSyncing ? "animate-spin" : "animate-pulse"}`} />
                      <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{backgroundSyncMessage || "Sincronizado"}</span>
                    </span></>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {!showPredictionForm && !showAdminPanel && (
                  <button onClick={() => { setSelectedParticipant(null); setShowPredictionForm(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-sky-500 hover:bg-sky-400 text-white text-xs uppercase font-extrabold tracking-wider rounded-lg shadow-md shadow-sky-500/30 transition-colors cursor-pointer">
                    <Plus className="w-4 h-4" />
                    {currentUserPrediction ? "Modificar mi Prode" : "Cargar mi Prode"}
                  </button>
                )}
                {!showAdminPanel && !showPredictionForm && (
                  <button onClick={() => { setSelectedParticipant(null); setShowAdminPanel(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs uppercase font-bold tracking-wider rounded-lg transition-colors border border-slate-800 cursor-pointer">
                    <Shield className="w-4 h-4 text-amber-500" /> Cargar Resultados
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={showPredictionForm || showAdminPanel || selectedParticipant ? "lg:col-span-1" : "lg:col-span-3"}>
                <Leaderboard
                  predictions={predictions}
                  tournament={activeTournament}
                  currentUserPrediction={currentUserPrediction}
                  currentUserId={user.uid}
                  onSelectParticipant={(name, results) => { setShowPredictionForm(false); setShowAdminPanel(false); setSelectedParticipant({ name, predictedResults: results }); }}
                />
              </div>
              {(showPredictionForm || showAdminPanel || selectedParticipant) && (
                <div className="lg:col-span-2 space-y-6">
                  {showPredictionForm && (
                    <PredictionForm tournament={activeTournament} existingPrediction={currentUserPrediction} currentUser={user} onSaveSuccess={() => setShowPredictionForm(false)} onCancel={() => setShowPredictionForm(false)} allPredictions={predictions} />
                  )}
                  {showAdminPanel && (
                    <AdminPanel tournament={activeTournament} onUpdateSuccess={() => {}} onCancel={() => setShowAdminPanel(false)} />
                  )}
                  {selectedParticipant && (
                    <ParticipantPredictionsView participantName={selectedParticipant.name} predictedResults={selectedParticipant.predictedResults} tournament={activeTournament} onClose={() => setSelectedParticipant(null)} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-600">
        <p className="flex items-center justify-center gap-1">Prode Mundial 2026 <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Familia & Amigos</p>
      </footer>
    </div>
  );
}