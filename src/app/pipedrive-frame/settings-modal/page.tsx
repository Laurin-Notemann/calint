'use client';  // This is required since we need interactivity【2-5】

import { useEffect, useState } from 'react';
import AppExtensionsSDK, { Command, Modal } from '@pipedrive/app-extensions-sdk';
import { useSearchParams } from 'next/navigation';
import { SettingsDataRes } from '@/app/api/v1/settings-modal/route';

export const dynamic = 'force-dynamic';

export default function PipedriveFrame() {
  const searchParams = useSearchParams();
  const [settingData, setSettingData] = useState<SettingsDataRes | null>(null)

  useEffect(() => {
    const userId = searchParams.get('userId');

    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize({ size: { height: 500, width: 500 } });
        // You can access Pipedrive context here
        const settings = sdk.userSettings;
        console.log('Pipedrive context:', settings);
        //        const { status } = await sdk.execute(Command.OPEN_MODAL, {
        //          type: Modal.JSON_MODAL,
        //          action_id: "Calint Settings"
        //        })
        //console.log('status', status);
      } catch (error) {
        console.error('Failed to initialize Pipedrive SDK:', error);
      }
    };

    const callApi = async () => {
      const res = await fetch("https://calint.laurinnotemann.dev/api/v1/settings-modal?userId=" + userId);

      const data: SettingsDataRes = await res.json();

      setSettingData(data)
    }

    initializePipedrive();
    callApi();
  }, []);

  return (
    <div className="p-4">

      {/* Your iframe content here */}
      <h1>Your Integration Content</h1>
      {settingData
        ? <div>Data Not there {settingData.data.calendlyEventTypes.map(event => (<>{event.name}</>))}</div>
        : <div>
          Error
        </div>
      }
      {/* Add your components and functionality */}
    </div>
  );
}

