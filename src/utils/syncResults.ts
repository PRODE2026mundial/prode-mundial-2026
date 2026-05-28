import { Match } from "../types";

export interface SyncReport {
  successCount: number;
  totalParsed: number;
  unmatchedTeams: string[];
  results: Record<string, "1" | "2" | "X" | null>;
  sourceType: "direct" | "fixture-array" | "object-array" | "unknown";
}

/**
 * Normalizes country names for reliable matchup comparisons (ignores accents, case, and dots)
 */
function normalizeTeamName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robustly parses fetched JSON data into a Record of matchId -> result mapping.
 */
export function parseExternalResults(data: any, matches: Match[]): SyncReport {
  const results: Record<string, "1" | "2" | "X" | null> = {};
  let successCount = 0;
  let totalParsed = 0;
  const unmatchedTeams: string[] = [];
  let sourceType: SyncReport["sourceType"] = "unknown";

  if (!data) {
    return { successCount, totalParsed, unmatchedTeams, results, sourceType };
  }

  // FORMAT 1: Direct key-value object mapping: e.g. { "j1_m1": "1", "j1_m2": "X" }
  const isDirectMap = 
    typeof data === "object" && 
    !Array.isArray(data) && 
    Object.keys(data).every(k => {
      const val = data[k];
      return val === "1" || val === "2" || val === "X" || val === null || val === "";
    });

  if (isDirectMap && Object.keys(data).length > 0) {
    sourceType = "direct";
    matches.forEach(m => {
      const val = data[m.id];
      if (val === "1" || val === "2" || val === "X") {
        results[m.id] = val;
        successCount++;
      } else if (val === null || val === "") {
        results[m.id] = null;
      }
      totalParsed++;
    });
    return { successCount, totalParsed, unmatchedTeams, results, sourceType };
  }

  // Parse arrays of match fixtures
  let matchesArray: any[] = [];
  if (Array.isArray(data)) {
    matchesArray = data;
  } else if (typeof data === "object") {
    // Check if there is an array property inside (e.g. { matches: [...] } or { fixtures: [...] })
    const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
    if (arrayKey) {
      matchesArray = data[arrayKey];
    }
  }

  if (matchesArray.length > 0) {
    sourceType = "fixture-array";
    
    // Create a normalized list of our matches to facilitate fast, clean lookup
    const matchesMap = matches.map(m => ({
      match: m,
      norm1: normalizeTeamName(m.team1),
      norm2: normalizeTeamName(m.team2)
    }));

    matchesArray.forEach((item) => {
      if (typeof item !== "object" || item === null) return;
      totalParsed++;

      // Try to extract team names
      const t1 = item.team1 || item.homeTeam || item.home_team || item.local || item.teamA || item.team_a;
      const t2 = item.team2 || item.awayTeam || item.away_team || item.visitante || item.teamB || item.team_b;

      if (!t1 || !t2) return;

      const normT1 = normalizeTeamName(typeof t1 === "object" ? t1.name || t1.displayName || "" : String(t1));
      const normT2 = normalizeTeamName(typeof t2 === "object" ? t2.name || t2.displayName || "" : String(t2));

      // Try to find matching game in our list
      const matchedMeta = matchesMap.find(m => 
        (m.norm1 === normT1 && m.norm2 === normT2) || 
        (m.norm1 === normT2 && m.norm2 === normT1)
      );

      if (!matchedMeta) {
        unmatchedTeams.push(`${t1} vs ${t2}`);
        return;
      }

      // Try to extract scores / goals
      // Common names: score1/score2, homeScore/awayScore, goals1/goals2, home_score/away_score, etc.
      let s1: any = undefined;
      let s2: any = undefined;

      const scoreKeys1 = ["score1", "homeScore", "home_score", "goalsLocal", "goals1", "localGoals", "homeGoals", "goalsA", "goals_home"];
      const scoreKeys2 = ["score2", "awayScore", "away_score", "goalsVisitante", "goals2", "awayGoals", "visitorGoals", "goalsB", "goals_away"];

      // Search item for score values
      for (const k of scoreKeys1) {
        if (item[k] !== undefined && item[k] !== null) {
          s1 = item[k];
          break;
        }
      }
      for (const k of scoreKeys2) {
        if (item[k] !== undefined && item[k] !== null) {
          s2 = item[k];
          break;
        }
      }

      // If scores are nested inside a score/result object (e.g. { score: { home: 1, away: 2 } or score: [1, 2] })
      if (s1 === undefined && item.score) {
        if (typeof item.score === "object") {
          s1 = item.score.home !== undefined ? item.score.home : item.score.local;
          s2 = item.score.away !== undefined ? item.score.away : item.score.visitante;
        } else if (Array.isArray(item.score) && item.score.length >= 2) {
          s1 = item.score[0];
          s2 = item.score[1];
        }
      }

      // If scores are found and are valid numbers or numeric strings
      if (s1 !== undefined && s2 !== undefined && s1 !== "" && s2 !== "") {
        const score1 = Number(s1);
        const score2 = Number(s2);

        if (!isNaN(score1) && !isNaN(score2)) {
          const mId = matchedMeta.match.id;
          const isReversed = matchedMeta.norm1 === normT2; // If JSON has team2 as home team

          let calculatedResult: "1" | "2" | "X";
          if (score1 > score2) {
            calculatedResult = isReversed ? "2" : "1";
          } else if (score2 > score1) {
            calculatedResult = isReversed ? "1" : "2";
          } else {
            calculatedResult = "X";
          }

          results[mId] = calculatedResult;
          successCount++;
        }
      } else {
        // Look for string results directly (some custom sources might just send {"result": "1" | "2" | "X"})
        const directResObj = item.result || item.winner || item.ganador;
        if (directResObj === "1" || directResObj === "2" || directResObj === "X") {
          const mId = matchedMeta.match.id;
          results[mId] = directResObj;
          successCount++;
        }
      }
    });

    return { successCount, totalParsed, unmatchedTeams: Array.from(new Set(unmatchedTeams)), results, sourceType };
  }

  // If no format matches, we might have an object of results keys
  // Let's do a loose extraction scan
  sourceType = "object-array";
  Object.keys(data).forEach((k) => {
    const item = data[k];
    if (typeof item === "object" && item !== null) {
      const res = item.result || item.winner;
      if (res === "1" || res === "2" || res === "X") {
        // Try searching for match key or team names
        const targetMatch = matches.find(m => m.id === k);
        if (targetMatch) {
          results[targetMatch.id] = res;
          successCount++;
        }
      }
    }
  });

  return { successCount, totalParsed, unmatchedTeams, results, sourceType };
}

/**
 * Fetches JSON results from custom URL with absolute proxy fallbacks in case of CORS rejection.
 */
export async function fetchExternalResults(url: string, matches: Match[]): Promise<SyncReport> {
  let cleanedUrl = url.trim();
  if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
    throw new Error("El enlace debe comenzar con http:// o https://");
  }

  // Fallback lists of proxies if direct fetch fails due to browser CORS origins
  const fetchStrategies = [
    // 1. Direct fetch
    async () => {
      const res = await fetch(cleanedUrl);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    },
    // 2. Secondary proxy try (Allorigins)
    async () => {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanedUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP Error through proxy ${res.status}`);
      return await res.json();
    },
    // 3. Third proxy try (Corsproxy.io)
    async () => {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(cleanedUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP Error through CORSProxy.io ${res.status}`);
      return await res.json();
    }
  ];

  let lastError: any = null;
  for (const strategy of fetchStrategies) {
    try {
      const data = await strategy();
      const parsed = parseExternalResults(data, matches);
      if (parsed.successCount > 0 || parsed.sourceType !== "unknown") {
        return parsed;
      }
    } catch (err: any) {
      console.warn("Sync strategy failed:", err);
      lastError = err;
    }
  }

  throw lastError || new Error("No se pudo obtener datos válidos ni conectar con la URL provista.");
}
