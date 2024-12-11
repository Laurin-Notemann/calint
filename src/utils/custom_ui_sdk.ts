import AppExtensionsSDK, {
  Command,
  Modal,
  View,
} from '@pipedrive/app-extensions-sdk';
import logger from './logger';

const log = logger('Custom UI SDK');
let SDK: AppExtensionsSDK | null = null;

export const getCustomUISDK = async (): Promise<AppExtensionsSDK> => {
  try {
    if (SDK) return SDK;
    log.info('Initializing SDK');
    SDK = await new AppExtensionsSDK().initialize({ size: { height: 550 } });
    return SDK;
  } catch (e) {
    log.error('Error during SDK initialization', e);
    throw e;
  }
};

export const hideFloatingWindow = async (sdk: AppExtensionsSDK): Promise<void> => {
  log.info('Hiding floating window');
  await sdk.execute(Command.HIDE_FLOATING_WINDOW, {});
};

export const showFloatingWindow = async (sdk: AppExtensionsSDK): Promise<void> => {
  log.info('Showing floating window');
  await sdk.execute(Command.SHOW_FLOATING_WINDOW, {});
};

export const openActivityModal = async (sdk: AppExtensionsSDK): Promise<void> => {
  log.info('Opening activity modal');
  await sdk.execute(Command.OPEN_MODAL, {
    type: Modal.ACTIVITY,
  });
};

export const redirectToContact = async (sdk: AppExtensionsSDK, id: string): Promise<void> => {
  log.info(`Redirecting to ${id}`);
  await sdk.execute(Command.REDIRECT_TO, { view: View.CONTACTS, id });
};

export const setNotification = async (sdk: AppExtensionsSDK, number: number): Promise<void> => {
  log.info(`Updating notification count to ${number}`);
  await sdk.execute(Command.SET_NOTIFICATION, {
    number,
  });
}; 