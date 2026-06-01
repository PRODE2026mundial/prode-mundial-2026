import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import { Trophy } from "lucide-react";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      const code = err.code || "";
      if (code === "auth/email-already-in-use") setError("Ese email ya está registrado. Probá iniciar sesión.");
      else if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") setError("Email o contraseña incorrectos.");
      else if (code === "auth/weak-password") setError("La contraseña debe tener al menos 6 caracteres.");
      else if (code === "auth/invalid-email") setError("El email no es válido.");
      else setError("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("No se pudo iniciar sesión con Google. Intentá de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md glass p-8 rounded-2xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sky-500/15 text-sky-400 mb-1">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Prode Mundial 2026</h1>
          <p className="text-sm text-slate-400">
            {mode === "login" ? "Iniciá sesión para acceder a tu prode." : "Creá tu cuenta para participar."}
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.5 4.6-4.6 6l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-500 font-mono">o con email</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer shadow-lg shadow-sky-500/30 transition-colors text-sm"
          >
            {loading ? "Cargando..." : mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          {mode === "login" ? (
            <>
              ¿No tenés cuenta?{" "}
              <button onClick={() => { setMode("register"); setError(null); }} className="text-sky-400 font-bold hover:underline cursor-pointer">
                Registrate acá
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{" "}
              <button onClick={() => { setMode("login"); setError(null); }} className="text-sky-400 font-bold hover:underline cursor-pointer">
                Iniciá sesión
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}