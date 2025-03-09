"use client";
import { MappingSelections, PipedriveSetup } from "./pipedrive-setup";
import { CalendlyEventSidebar } from "./calendly-event-sidebar";
import { useState } from "react";
import { SettingsDataRes } from "@/lib/calint-setup";
import { CalEventType } from "@/db/schema";
import { env } from "@/lib/env";
import { MappingsRequestBody } from "@/app/api/v1/mapping/create/route";

const SetupFrame = ({
  settingsData,
  userId,
}: {
  settingsData: SettingsDataRes | undefined;
  userId: string;
}) => {
  const [selectedEventType, setSelectedEventType] =
    useState<CalEventType | null>(null);

  if (!settingsData || !settingsData.data || !settingsData.data.calendlyEventTypes) {
    return <div>Missing required data from settings</div>;
  }

  const handleSaveMappings = async (mappings: MappingSelections) => {
    try {
      if (!selectedEventType) {
        throw new Error("EventType not selected");
      }
      const body: MappingsRequestBody = {
        mappings,
        eventTypeId: selectedEventType.id,
      };
      await fetch(
        env.NEXT_PUBLIC_BASE_URL + "/api/v1/mapping/create?userId=" + userId,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    } catch (error) {
      console.error("Failed to save mappings:", error);
    }
  };

  return (
    <div className="h-screen flex text-2xl p-4">
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
          mappings={settingsData.data.typeMappings}
          onSaveMappings={handleSaveMappings}
        />
      </div>
    </div>
  );
};

export default SetupFrame;
