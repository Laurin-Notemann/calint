import { createContext, useContext, useState, ReactNode } from 'react';
import { AppContextState } from '../utils/types';
import logger from '../utils/logger';

const AppContext = createContext<AppContextState | undefined>(undefined);
const log = logger('App Context');

interface AppContextWrapperProps {
  children: ReactNode;
}

export const AppContextWrapper = ({ children }: AppContextWrapperProps) => {
  const [user, setUser] = useState({});
  const [callerState, setCallerState] = useState<string>('listening');
  const [missedCall, setMissedCall] = useState<number>(0);
  const [callerDetails, setCallerDetails] = useState({});

  const sharedState: AppContextState = {
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
    <AppContext.Provider value={sharedState}>{children}</AppContext.Provider>
  );
};

export const useAppContext = (): AppContextState => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextWrapper');
  }
  return context;
}; 