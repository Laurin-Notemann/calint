"use client";
import { PipedriveSetup } from "./pipedrive-setup";
import { CalendlyEventSidebar } from "./calendly-event-sidebar";
import { useState } from "react";
import { SettingsDataRes } from "@/lib/calint-setup";
import { CalEventType } from "@/db/schema";

const SetupFrame = ({
  settingsData,
}: {
  settingsData: SettingsDataRes | undefined;
}) => {
  const [selectedEventType, setSelectedEventType] =
    useState<CalEventType | null>(null);
  return (
    <div className="h-screen flex text-2xl p-4">
      {settingsData ? (
        <>
          <div className="w-1/3">
            <CalendlyEventSidebar
              eventTypes={settingsData.data.calendlyEventTypes}
              onEventTypeSelect={setSelectedEventType}
              selectedEventType={selectedEventType}
            />
          </div>
          <div className="w-2/3 p-4">
            <PipedriveSetup
              activities={settingsData.data.pipedriveAcitvityTypes}
              eventType={selectedEventType}
            />
          </div>
        </>
      ) : (
        <div>Error</div>
      )}
    </div>
  );
};


export default SetupFrame;
