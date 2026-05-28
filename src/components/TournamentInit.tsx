import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Tournament } from "../types";
import { Trophy, Key, Users, Copy, Check, ArrowRight } from "lucide-react";

interface TournamentInitProps {
  onSelectTournament: (tournament: Tournament) => void;
  initialTournamentId: string | null;
}

export function TournamentInit({ onSelectTournament, initialTournamentId }: TournamentInitProps) {
  const [activeTab, setActiveTab] = useState<"join" | "create">(initialTournamentId ? "join" : "create");
  
  // Create tournament states
  const [createName, setCreateName] = useState("");
  const [createAccessPass, setCreateAccessPass] = useState("");
  const [createAdminPass, setCreateAdminPass] = useState("");
  
  // Join tournament states
  const [joinId, setJoinId] = useState(initialTournamentId || "");
  const [joinAccessPass, setJoinAccessPass] = useState("");
  
  // Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialTournamentId) {
      setJoinId(initialTournamentId);
      setActiveTab("join");
    }
  }, [initialTournamentId]);

  function generateShortId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!createName.trim() || !createAccessPass.trim() || !createAdminPass.trim()) {
      setError("Por favor completa todos los campos.");
      setLoading(false);
      return;
    }

    const tId = generateShortId();
    const cleanId = tId.trim();

    try {
      const docRef = doc(db, "tournaments", cleanId);
      
      const newTournament = {
        name: createName.trim(),
        accessPassword: createAccessPass.trim(),
        adminPassword: createAdminPass.trim(),
        results: {},
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, newTournament);
      setSuccessId(cleanId);
    } catch (err) {
      setError("No se pudo crear el torneo. Verifica las reglas o conexión de red.");
      try {
        handleFirestoreError(err, OperationType.CREATE, `tournaments/${cleanId}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanId = joinId.trim().toLowerCase();
    if (!cleanId || !joinAccessPass.trim()) {
      setError("Ingresa el ID del torneo y la contraseña.");
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "tournaments", cleanId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError("Torneo no encontrado. Revisa el ID ingresado.");
        setLoading(false);
        return;
      }

      const tData = docSnap.data();
      if (tData.accessPassword !== joinAccessPass.trim()) {
        setError("Contraseña de acceso incorrecta.");
        setLoading(false);
        return;
      }

      onSelectTournament({
        id: cleanId,
        name: tData.name,
        accessPassword: tData.accessPassword,
        adminPassword: tData.adminPassword,
        results: tData.results || {},
        resultsSourceUrl: tData.resultsSourceUrl || "",
        createdAt: tData.createdAt
      });
    } catch (err) {
      setError("Error al conectar con la base de datos.");
      try {
        handleFirestoreError(err, OperationType.GET, `tournaments/${cleanId}`);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  const shareLink = successId ? `${window.location.origin}?t=${successId}` : "";

  const copyToClipboard = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto glass p-6 shadow-2xl rounded-2xl" id="tournament-init-card">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sky-500/15 text-sky-400 mb-3" id="trophy-wrapper">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2" id="main-title">
          Prode Mundial 2026
        </h1>
        <p className="text-sm text-slate-400" id="main-subtitle">
          Crea una competencia entre amigos y familiares o únete a una existente.
        </p>
      </div>

      {successId ? (
        <div className="p-6 bg-slate-950/50 border border-sky-500/30 rounded-xl text-center space-y-4" id="success-screen">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/20 text-sky-400" id="success-checkmark-wrapper">
            <Check className="w-6 h-6 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-white" id="success-title">¡Torneo Creado Exitosamente!</h3>
          <p className="text-sm text-slate-400" id="success-description">
            Comparte este enlace privado con tu familia y amigos para que completen su prode.
          </p>
          
          <div className="flex flex-col gap-2 p-3 bg-slate-900 rounded-lg text-left" id="creds-summary">
            <div className="text-xs text-slate-500 font-mono">ID DEL TORNEO: <span className="text-sky-450 font-bold">{successId}</span></div>
            <div className="text-xs text-slate-500 font-mono font-bold">CONTRASEÑA: <span className="text-sky-400">{createAccessPass}</span></div>
            <div className="text-xs text-slate-500 font-mono">CONTRASEÑA ADMIN: <span className="text-amber-400 font-bold">{createAdminPass}</span></div>
            <span className="text-[10px] text-amber-500 leading-snug font-serif mt-1">
              *Guarda estos valores. Necesitarás la contraseña de administración para actualizar los resultados reales del torneo.
            </span>
          </div>

          <div className="flex gap-2" id="share-action-row">
            <button
              onClick={copyToClipboard}
              id="btn-copy-link"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-sky-400" /> ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar Enlace
                </>
              )}
            </button>
            <button
              id="btn-go-to-tournament"
              onClick={() => {
                onSelectTournament({
                  id: successId,
                  name: createName,
                  accessPassword: createAccessPass,
                  adminPassword: createAdminPass,
                results: {},
resultsSourceUrl: "",
createdAt: new Date()
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold shadow-lg shadow-sky-500/30 transition-colors cursor-pointer"
            >
              Entrar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Navigation Tab */}
          <div className="flex border-b border-slate-800 mb-6" id="nav-tab-wrapper">
            <button
              id="tab-join"
              type="button"
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-colors cursor-pointer ${
                activeTab === "join"
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
              onClick={() => {
                setActiveTab("join");
                setError(null);
              }}
            >
              Unirse con Contraseña
            </button>
            <button
              id="tab-create"
              type="button"
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-colors cursor-pointer ${
                activeTab === "create"
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
              onClick={() => {
                setActiveTab("create");
                setError(null);
              }}
            >
              Crear Nuevo Torneo
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg font-medium" id="error-alert">
              {error}
            </div>
          )}

          {activeTab === "join" ? (
            <form onSubmit={handleJoin} className="space-y-4" id="form-join">
              <div id="field-join-id">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  ID del Torneo (Código Privado)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Users className="w-5 h-5" />
                  </span>
                  <input
                    id="input-join-id"
                    type="text"
                    placeholder="Ej. wxyz1234"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div id="field-join-pass">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Contraseña de Acceso
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Key className="w-5 h-5" />
                  </span>
                  <input
                    id="input-join-pass"
                    type="password"
                    placeholder="Ej. familia-sanchez"
                    value={joinAccessPass}
                    onChange={(e) => setJoinAccessPass(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                id="btn-join-submit"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg cursor-pointer shadow-lg shadow-sky-500/30 transition-colors"
              >
                {loading ? "Verificando..." : "Entrar al Torneo"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4" id="form-create">
              <div id="field-create-name">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Nombre del Torneo
                </label>
                <input
                  id="input-create-name"
                  type="text"
                  placeholder="Ej. Prode Familiar 2026"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div id="field-create-access-pass">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Contraseña de Invitados (Para unirse)
                </label>
                <input
                  id="input-create-access-pass"
                  type="text"
                  placeholder="Ej. amigos2026"
                  value={createAccessPass}
                  onChange={(e) => setCreateAccessPass(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <span className="text-[10px] text-slate-500 leading-snug block mt-1">
                  *Esta contraseña la usarán tus amigos y familiares para entrar y crear sus predicciones.
                </span>
              </div>

              <div id="field-create-admin-pass">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Contraseña de Administración (Para cargar resultados)
                </label>
                <input
                  id="input-create-admin-pass"
                  type="text"
                  placeholder="Ej. admin-secreto"
                  value={createAdminPass}
                  onChange={(e) => setCreateAdminPass(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <span className="text-[10px] text-amber-500 leading-snug block mt-1">
                  *IMPORTANTE: Solo tú debes saber esta contraseña. Sirve para cargar los resultados reales de cada partido.
                </span>
              </div>

              <button
                id="btn-create-submit"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg cursor-pointer shadow-lg shadow-sky-500/30 transition-colors"
              >
                {loading ? "Creando Torneo..." : "Crear Torneo"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
