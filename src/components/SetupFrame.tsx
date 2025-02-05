"use client";
import { PipedriveSetup } from "./pipedrive-setup";
import { CalendlyEventSidebar } from "./calendly-event-sidebar";
import { useState } from "react";
import { EventType } from "@/lib/calendly-client";
import { SettingsDataRes } from "@/lib/calint-setup";

const SetupFrame = ({
  settingsData,
}: {
  settingsData: SettingsDataRes | undefined;
}) => {
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(
    null,
  );
  return (
    <div className="p-4 text-2xl">
      {settingsData ? (
        <div className="flex gap-2">
          <CalendlyEventSidebar
            eventTypes={settingsData.data.calendlyEventTypes.collection}
            onEventTypeSelect={setSelectedEventType}
            selectedEventType={selectedEventType}
          />
          <PipedriveSetup
            activities={settingsData.data.pipedriveAcitvityTypes}
            eventType={selectedEventType}
          />
        </div>
      ) : (
        <div>Error</div>
      )}
    </div>
  );
};

export default SetupFrame;
