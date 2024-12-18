'use client';  // This is required since we need interactivity【2-5】

import { useEffect } from 'react';
import AppExtensionsSDK, { Command, Modal } from '@pipedrive/app-extensions-sdk';

export default function PipedriveFrame() {
  useEffect(() => {
    // Initialize Pipedrive SDK
    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize();
        // You can access Pipedrive context here
        const settings = sdk.userSettings;
        console.log('Pipedrive context:', settings);
        const { status } = sdk.execute(Command.OPEN_MODAL, {
          type: Modal.JSON_MODAL,
          action_id: "test panel"
        })
      } catch (error) {
        console.error('Failed to initialize Pipedrive SDK:', error);
      }
    };

    initializePipedrive();
  }, []);

  return (
    <div className="p-4">
      {/* Your iframe content here */}
      <h1>Your Integration Content</h1>
      {/* Add your components and functionality */}
    </div>
  );
}

