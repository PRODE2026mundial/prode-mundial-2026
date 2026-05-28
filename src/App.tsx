import React, { useState, useEffect } from "react";
import { doc, collection, onSnapshot, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Tournament, Prediction } from "./types";
import { TournamentInit } from "./components/TournamentInit";
import { Leaderboard } from "./components/Leaderboard";
import { PredictionForm } from "./components/PredictionForm";
import { AdminPanel } from "./components/AdminPanel";
import { ParticipantPredictionsView } from "./components/ParticipantPredictionsView";
import { Trophy, LogOut, Plus, Shield, Share2, Check, Sparkles, Globe, RefreshCw } from "lucide-react";
import { MATCHES } from "./data/matches";
import { fetchExternalResults } from "./utils/syncResults";

export default function App() {
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialTourneyId, setInitialTourneyId] = useState<string | null>(null);

  // Background sync tracking states
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState<string | null>(null);

  // Modal and focus views
  const [showPredictionForm, setShowPredictionForm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    name: string;
    predictedResults: Record<string, "1" | "2" | "X" | "">;
  } | null>(null);

  // Link copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // URL query parameter parsing on startup
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlTId = queryParams.get("t");
    if (urlTId) {
      setInitialTourneyId(urlTId);
    }
  }, []);

  // Set up Firebase Realtime listeners when a tournament is active!
  useEffect(() => {
    if (!activeTournament) {
      setPredictions([]);
      return;
    }

    setLoading(true);

    // 1. Listen to active tournament details (especially results updates)
    const tournamentDocRef = doc(db, "tournaments", activeTournament.id);
    const unsubscribeTournament = onSnapshot(
      tournamentDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setActiveTournament((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              name: data.name,
              results: data.results || {},
              resultsSourceUrl: data.resultsSourceUrl || "",
              accessPassword: data.accessPassword,
              adminPassword: data.adminPassword
            };
          });
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, `tournaments/${activeTournament.id}`);
        } catch (ex) {
          console.error(ex);
        }
      }
    );

    // 2. Listen to predictions subcollection to recalculate standings on-the-fly
    const predictionsCollRef = collection(db, "tournaments", activeTournament.id, "predictions");
    const unsubscribePredictions = onSnapshot(
      predictionsCollRef,
      (querySnap) => {
        const loadedPredictions: Prediction[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          loadedPredictions.push({
            id: docSnap.id,
            participantName: data.participantName,
            predictedResults: data.predictedResults || {},
            createdAt: data.createdAt
          });
        });
        setPredictions(loadedPredictions);
        setLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `tournaments/${activeTournament.id}/predictions`);
        } catch (ex) {
          console.error(ex);
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTournament();
      unsubscribePredictions();
    };
  }, [activeTournament?.id]);

  // Background automated results reading and Firestore scoring synchronization
  useEffect(() => {
    if (!activeTournament || !activeTournament.resultsSourceUrl) {
      setBackgroundSyncMessage(null);
      return;
    }

    const runAutomatedSync = async () => {
      setIsBackgroundSyncing(true);
      setBackgroundSyncMessage("Leyendo resultados en vivo...");
      try {
        const report = await fetchExternalResults(activeTournament.resultsSourceUrl!, MATCHES);
        
        // Match fetched results with current results
        let hasNewUpdates = false;
        const currentResults = { ...activeTournament.results };

        Object.entries(report.results).forEach(([matchId, val]) => {
          if (val && activeTournament.results[matchId] !== val) {
            currentResults[matchId] = val;
            hasNewUpdates = true;
          }
        });

        if (hasNewUpdates) {
          // Transparently push updates to Firestore so everyone gets recalculations instantly!
          const docRef = doc(db, "tournaments", activeTournament.id);
          await updateDoc(docRef, {
            results: currentResults
          });
          setBackgroundSyncMessage("¡Historial de posiciones actualizado automáticamente con el Mundial!");
        } else {
          setBackgroundSyncMessage("Resultados de la Copa en vivo actualizados.");
        }
        
        // Clean feedback after active cycle
        setTimeout(() => setBackgroundSyncMessage(null), 6000);
      } catch (err: any) {
        console.warn("Background auto sync was throttled or CORS restricted:", err);
        setBackgroundSyncMessage("Sincronización en vivo disponible.");
        setTimeout(() => setBackgroundSyncMessage(null), 5000);
      } finally {
        setIsBackgroundSyncing(false);
      }
    };

    // Run on loaded
    runAutomatedSync();

    // Auto-pull every 4 minutes to guarantee live scoreboard refreshing
    const syncInterval = setInterval(runAutomatedSync, 240000);
    return () => clearInterval(syncInterval);
  }, [activeTournament?.id, activeTournament?.resultsSourceUrl]);

  // Find the current browser's local prediction if they submitted one in the past
  const currentUserPrediction = React.useMemo(() => {
    if (!activeTournament) return null;
    const localUsernameKey = `prode_username_${activeTournament.id}`;
    const localUserName = localStorage.getItem(localUsernameKey);
    
    if (!localUserName) return null;
    return predictions.find((p) => p.participantName === localUserName) || null;
  }, [predictions, activeTournament?.id]);

  const handleSelectTournament = (tournament: Tournament) => {
    setActiveTournament(tournament);
    // Push short ID to query parameter without full reload
    const newUrl = `${window.location.origin}?t=${tournament.id}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
  };

  const handleExitTournament = () => {
    setActiveTournament(null);
    setShowPredictionForm(false);
    setShowAdminPanel(false);
    setSelectedParticipant(null);
    // Remove query parameter
    const originUrl = window.location.origin;
    window.history.pushState({ path: originUrl }, "", originUrl);
  };

  const copyShareLink = () => {
    if (activeTournament) {
      const shareUrl = `${window.location.origin}?t=${activeTournament.id}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="app-root">
      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur sticky top-0 z-40 px-4 py-3.5" id="app-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between" id="header-container">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleExitTournament} id="app-logo">
            <Trophy className="w-6 h-6 text-sky-400" />
            <span className="font-extrabold tracking-tight text-white text-lg">Prode Mundial 2026</span>
          </div>

          {activeTournament && (
            <div className="flex items-center gap-2" id="header-actions">
              <button
                onClick={copyShareLink}
                id="header-btn-copy"
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded text-xs bg-slate-800 hover:bg-slate-700 font-medium text-slate-300 transition-colors cursor-pointer"
                title="Copiar enlace para compartir"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-sky-400" /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" /> Compartir Link
                  </>
                )}
              </button>
              <button
                onClick={handleExitTournament}
                id="header-btn-exit"
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Cambiar de torneo"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center py-8 px-4 max-w-7xl w-full mx-auto" id="app-main">
        {!activeTournament ? (
          <div className="w-full flex flex-col items-center justify-center py-6" id="welcome-view">
            <TournamentInit
              onSelectTournament={handleSelectTournament}
              initialTournamentId={initialTourneyId}
            />
          </div>
        ) : (
          <div className="space-y-6" id="tournament-dashboard">
            {/* Tournament Info Header */}
            <div className="p-5 glass rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg" id="tournament-detail-banner">
              <div className="space-y-1.5" id="banner-text">
                <span className="text-[10px] bg-sky-500/15 text-sky-400 font-extrabold tracking-widest uppercase py-0.5 px-2 rounded-full border border-sky-500/20">
                  Torneo Activo
                </span>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{activeTournament.name}</h2>
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs text-slate-400 font-mono" id="banner-subs">
                  <span>ID: <strong className="text-sky-400">{activeTournament.id}</strong></span>
                  <span>•</span>
                  <span>Participantes: <strong className="text-white">{predictions.length}</strong></span>
                  {activeTournament.resultsSourceUrl && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold" title={activeTournament.resultsSourceUrl}>
                        <Globe className={`w-3.5 h-3.5 text-emerald-400 ${isBackgroundSyncing ? 'animate-spin' : 'animate-pulse'}`} />
                        <span className="hidden sm:inline">Mundial en Vivo:</span>
                        <span className="text-[10px] text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {backgroundSyncMessage || "Sincronizado"}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="flex flex-wrap items-center gap-2.5" id="banner-buttons">
                {!showPredictionForm && !showAdminPanel && (
                  <button
                    onClick={() => {
                      setSelectedParticipant(null);
                      setShowPredictionForm(true);
                    }}
                    id="btn-trigger-prode"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-sky-500 hover:bg-sky-400 text-white text-xs uppercase font-extrabold tracking-wider rounded-lg shadow-md shadow-sky-500/30 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {currentUserPrediction ? "Modificar mi Prode" : "Cargar mi Prode"}
                  </button>
                )}

                {!showAdminPanel && !showPredictionForm && (
                  <button
                    onClick={() => {
                      setSelectedParticipant(null);
                      setShowAdminPanel(true);
                    }}
                    id="btn-trigger-admin"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs uppercase font-bold tracking-wider rounded-lg transition-colors border border-slate-800 cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-amber-500" />
                    Cargar Resultados
                  </button>
                )}
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-grid">
              
              {/* Standings Table (Spans 2 columns if not displaying sub-actions) */}
              <div className={showPredictionForm || showAdminPanel || selectedParticipant ? "lg:col-span-1" : "lg:col-span-3"} id="leaderboard-col">
                <Leaderboard
                  predictions={predictions}
                  tournament={activeTournament}
                  currentUserPrediction={currentUserPrediction}
                  onSelectParticipant={(name, results) => {
                    setShowPredictionForm(false);
                    setShowAdminPanel(false);
                    setSelectedParticipant({ name, predictedResults: results });
                  }}
                />
              </div>

              {/* Action Columns (Shows either Predictions form, Admin dashboard, or spectator sheet) */}
              {(showPredictionForm || showAdminPanel || selectedParticipant) && (
                <div className="lg:col-span-2 space-y-6" id="action-col">
                  {showPredictionForm && (
                    <PredictionForm
                      tournament={activeTournament}
                      existingPrediction={currentUserPrediction}
                      onSaveSuccess={(saved) => {
                        setShowPredictionForm(false);
                      }}
                      onCancel={() => setShowPredictionForm(false)}
                      allPredictions={predictions}
                    />
                  )}

                  {showAdminPanel && (
                    <AdminPanel
                      tournament={activeTournament}
                      onUpdateSuccess={(updatedRes) => {
                        // Standing calculation shifts inside listener instantly
                      }}
                      onCancel={() => setShowAdminPanel(false)}
                    />
                  )}

                  {selectedParticipant && (
                    <ParticipantPredictionsView
                      participantName={selectedParticipant.name}
                      predictedResults={selectedParticipant.predictedResults}
                      tournament={activeTournament}
                      onClose={() => setSelectedParticipant(null)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-600" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="flex items-center justify-center gap-1">
            Prode Mundial 25 de junio de 2026 <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Familia & Amigos
          </p>
          <p className="text-[10px]">Guarda tu ID y contraseña privados para sincronizar resultados en cualquier momento.</p>
        </div>
      </footer>
    </div>
  );
}
