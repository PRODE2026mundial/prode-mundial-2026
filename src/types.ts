export interface Match {
  id: string;
  team1: string;
  team2: string;
  date: string;
  group: string;
  jornada: number;
  kickoff: string;
}

export interface Tournament {
  id: string;
  name: string;
  accessPassword: string;
  adminPassword: string;
  results: Record<string, "1" | "2" | "X" | null>;
  resultsSourceUrl?: string;
  prizeText?: string;
  createdAt: any;
}

export interface Prediction {
  id: string;
  participantName: string;
  predictedResults: Record<string, "1" | "2" | "X" | "">;
  createdAt: any;
  userId: string | null;
}

export interface StandingsRow {
  participantName: string;
  points: number;
  totalPredicted: number;
  hits: number;
}