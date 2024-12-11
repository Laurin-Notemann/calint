interface Session {
  auth: boolean;
  id: string;
  name: string;
  token: string;
}

interface CallerDetails {
  number?: string;
  id?: string;
  direction: 'in' | 'out';
  existing: boolean;
}

interface User {
  accountId: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AppContextState {
  user: any;
  setUser: (user: any) => void;
  callerState: string;
  setCallerState: (state: string) => void;
  callerDetails: CallerDetails;
  setCallerDetails: (details: CallerDetails) => void;
  missedCall: number;
  setMissedCall: (count: number) => void;
}

export type { Session, CallerDetails, User, AppContextState }; 