import { Socket } from 'socket.io-client';
import { AppContextState } from './types';
import logger from './logger';
import AppExtensionsSDK from '@pipedrive/app-extensions-sdk';

const log = logger('socket');

interface CallEvent {
  number: string;
}

export const handleSocketCommunication = (
  socket: Socket | null,
  props: AppContextState,
  sdk: AppExtensionsSDK
): void => {
  if (socket) {
    socket.on('connect', () => {
      log.info('Client connected.');
    });

    socket.on('OUTBOUND_CALL', (...args: any[]) => {
      log.info('Receiving outgoing call...');
    });

    socket.on('INBOUND_CALL', (args: CallEvent) => {
      log.info('Receiving incoming call...');

      if (props.callerState === 'listening') {
        startIncomingCall(props, args.number);
      } else {
        log.info('Cannot place a call when a current call is in progress');
      }
    });
  }
};

export const startIncomingCall = (props: AppContextState, number: string): void => {
  const details = {
    number,
    direction: 'in' as const,
    existing: false,
  };
  props.setCallerState('ringing');
  props.setCallerDetails(details);
};

export const startOutgoingCall = (props: AppContextState, id: string): void => {
  const details = {
    id,
    direction: 'out' as const,
    existing: true,
  };
  props.setCallerState('ringing');
  setTimeout(() => {
    props.setCallerState('connected');
  }, 2000);

  props.setCallerDetails(details);
}; 