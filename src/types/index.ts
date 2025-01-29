export interface User {
  id: string;
  name: string;
  token: string;
  auth: boolean;
}

export interface CallerDetails {
  id?: string;
  name?: string;
  number?: string;
  picture?: string;
  direction?: "in" | "out";
  existing?: boolean;
  relatedDeals?: Deal[];
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
}

export interface Contact {
  contactId: string;
  contactName: string;
  contactNumber: string;
  direction: "in" | "out";
}

export interface AppContextType {
  user: User;
  setUser: (user: User) => void;
  callerState: "listening" | "ringing" | "connected" | "disconnected";
  setCallerState: (
    state: "listening" | "ringing" | "connected" | "disconnected",
  ) => void;
  callerDetails: CallerDetails;
  setCallerDetails: (details: CallerDetails) => void;
  missedCall: number;
  setMissedCall: (count: number) => void;
}
