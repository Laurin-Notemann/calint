'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AppContextType, User, CallerDetails } from '@/types';
import logger from '../utils/logger';

const log = logger('App Context');

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>({} as User);
  const [callerState, setCallerState] = useState<'listening' | 'ringing' | 'connected' | 'disconnected'>('listening');
  const [missedCall, setMissedCall] = useState(0);
  const [callerDetails, setCallerDetails] = useState<CallerDetails>({});

  const sharedState: AppContextType = {
    user,
    setUser,
    callerState,
    setCallerState,
    callerDetails,
    setCallerDetails,
    missedCall,
    setMissedCall,
  };

  log.info('Context created');
  
  return (
    <AppContext.Provider value={sharedState}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}; 