import { PipedriveMapping } from "./pipedrive-mapping";
import { EventType } from "@/lib/calendly-client";
import { ActivityType } from "pipedrive/v1";
import { useState } from "react";

type PipedriveSetupProps = {
  activities: ActivityType[];
  eventType: EventType | null;
};

type MappingSelections = {
  [key: string]: ActivityType | null;
};

const mappings = ["Created", "Rescheduled", "Cancelled", "Noshow"];

export const PipedriveSetup: React.FC<PipedriveSetupProps> = ({
  activities,
  eventType,
}) => {
  const [selectedActivities, setSelectedActivities] =
    useState<MappingSelections>({});

  const handleActivitySelect = (
    mappingName: string,
    activity: ActivityType,
  ) => {
    setSelectedActivities((prev) => ({
      ...prev,
      [mappingName]: activity,
    }));
  };

  return (
    <div className="bg-gray-50 p-4">
      <h2 className="mb-4">Setup for: {eventType?.name}</h2>
      {mappings.map((mappingName, index) => (
        <PipedriveMapping
          key={index}
          name={mappingName}
          pipedriveActivities={activities}
          selectedActivity={selectedActivities[mappingName]}
          onActivitySelect={(activity) =>
            handleActivitySelect(mappingName, activity)
          }
        />
      ))}
    </div>
  );
};
