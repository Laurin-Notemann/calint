"use client";

import { useEffect, useState, Suspense } from "react";
import AppExtensionsSDK, {
  Command,
  Modal,
} from "@pipedrive/app-extensions-sdk";
import { useSearchParams } from "next/navigation";
import { SettingsDataRes } from "@/app/api/v1/settings-modal/route";
import { useQuery } from "@tanstack/react-query";

export const dynamic = "force-dynamic";

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const { isLoading, error, data: settingsData } = useQuery({
    queryKey: ["settingsData"],
    queryFn: async (): Promise<SettingsDataRes> => {
      const res = await fetch(
        "https://calint.laurinnotemann.dev/api/v1/settings-modal?userId=" +
        searchParams.get("userId"),
      );

      return res.json()
    }
  });

  useEffect(() => {
    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize({
          size: { height: 500, width: 500 },
        });
        const settings = sdk.userSettings;
        console.log("Pipedrive context:", settings);
      } catch (error) {
        console.error("Failed to initialize Pipedrive SDK:", error);
      }
    };

    initializePipedrive();
  }, [searchParams]);

  if (error) return <div>Could not get Calendly or Pipedrive information {error.message}</div>;

  if (isLoading) return <div>Currently calendly and Pipedrive data</div>;

  return (
    <div className="p-4">
      {settingsData ? (
        <div>
          {settingsData.data.calendlyEventTypes.collection.map(
            (event, index) => (
              <div className="flex flex-row gap-2" key={index}>
                <span key={index}>{event.name}</span>
                <div>
                  <div className="flex gap-2">
                    <h3>Created</h3>
                    <select>
                      {settingsData.data.pipedriveAcitvityTypes.map(
                        (activity, index) => (
                          <option key={index}>{activity.name}</option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <h3>Rescheduled</h3>
                    <select>
                      {settingsData.data.pipedriveAcitvityTypes.map(
                        (activity, index) => (
                          <option key={index}>{activity.name}</option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <h3>Cancelled</h3>
                    <select>
                      {settingsData.data.pipedriveAcitvityTypes.map(
                        (activity, index) => (
                          <option key={index}>{activity.name}</option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <h3>Noshow</h3>
                    <select>
                      {settingsData.data.pipedriveAcitvityTypes.map(
                        (activity, index) => (
                          <option key={index}>{activity.name}</option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div>Error</div>
      )}
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
