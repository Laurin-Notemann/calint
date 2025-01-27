'use client';

import { useEffect, useState, Suspense } from 'react';
import AppExtensionsSDK, { Command, Modal } from '@pipedrive/app-extensions-sdk';
import { useSearchParams } from 'next/navigation';
import { SettingsDataRes } from '@/app/api/v1/settings-modal/route';

export const dynamic = 'force-dynamic';

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const [settingData, setSettingData] = useState<SettingsDataRes | null>(null);

  useEffect(() => {
    const userId = searchParams.get('userId');

    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize({ size: { height: 500, width: 500 } });
        const settings = sdk.userSettings;
        console.log('Pipedrive context:', settings);
      } catch (error) {
        console.error('Failed to initialize Pipedrive SDK:', error);
      }
    };

    const callApi = async () => {
      const res = await fetch("https://calint.laurinnotemann.dev/api/v1/settings-modal?userId=" + userId);
      const data: SettingsDataRes = await res.json();
      setSettingData(data);
    }

    initializePipedrive();
    callApi();
  }, [searchParams]);

  return (
    <div className="p-4">
      {settingData
        ? <div>{settingData.data.calendlyEventTypes.collection.map((event, index) => (
          <div className='flex flex-row gap-2' key={index}>
            <span key={index}>{event.name}</span>
            <div>
              <div className='flex gap-2'>
                <h3>Created</h3>
                <select>
                  {settingData.data.pipedriveAcitvityTypes.map((activity, index) => (
                    <option key={index}>{activity.name}</option>
                  ))}
                </select>
              </div>
              <div className='flex gap-2'>
                <h3>Rescheduled</h3>
                <select>
                  {settingData.data.pipedriveAcitvityTypes.map((activity, index) => (
                    <option key={index}>{activity.name}</option>
                  ))}
                </select>
              </div>
              <div className='flex gap-2'>
                <h3>Cancelled</h3>
                <select>
                  {settingData.data.pipedriveAcitvityTypes.map((activity, index) => (
                    <option key={index}>{activity.name}</option>
                  ))}
                </select>
              </div>
              <div className='flex gap-2'>
                <h3>Noshow</h3>
                <select>
                  {settingData.data.pipedriveAcitvityTypes.map((activity, index) => (
                    <option key={index}>{activity.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        </div>
        : <div>
          Error
        </div>
      }
    </div>
  );
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}

