"use client"; // This is required since we need interactivity【2-5】

import { useEffect } from "react";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";

export const dynamic = "force-dynamic";

export default function PipedriveFrame() {
  useEffect(() => {
    // Initialize Pipedrive SDK
    const initializePipedrive = async () => {
      try {
        await new AppExtensionsSDK().initialize();
        // You can access Pipedrive context here
        //const settings = sdk.userSettings;
        //console.log('Pipedrive context:', settings);
        //const { status } = await sdk.execute(Command.OPEN_MODAL, {
        //  type: Modal.JSON_MODAL,
        //  action_id: "Calint Settings"
        //})
        //console.log('status', settings);
      } catch (error) {
        console.error("Failed to initialize Pipedrive SDK:", error);
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
