import React, { useState, useEffect } from "react";
import { CalEventType, TypeEnum, TypeMappingType } from "@/db/schema";
import { PipedriveMapping } from "./pipedrive-mapping";
import { ActivityType } from "pipedrive/v1";

type PipedriveSetupProps = {
  activities: ActivityType[];
  eventType: CalEventType | null;
  mappings: TypeMappingType[];
  onSaveMappings: (mappings: MappingSelections) => void;
};

export type MappingSelections = {
  [K in TypeEnum[number]]?: ActivityType | null;
};

const mappingTitles: TypeEnum = [
  "created",
  "rescheduled",
  "cancelled",
  "noshow",
];

export const PipedriveSetup: React.FC<PipedriveSetupProps> = ({
  activities,
  eventType,
  mappings,
  onSaveMappings,
}) => {
  const [selectedActivities, setSelectedActivities] =
    useState<MappingSelections>({});

  useEffect(() => {
    if (eventType) {
      const eventMappings = mappings.filter(
        (mapping) => mapping.calendlyEventTypeId === eventType.id,
      );
      const initialSelections: MappingSelections = {};

      mappingTitles.forEach((title) => {
        const mapping = eventMappings.find((m) => m.type === title);
        if (mapping && mapping.pipedriveActivityTypeId) {
          const activity = activities.find(
            (a) =>
              a.id &&
              a.id.toString() === mapping.pipedriveActivityTypeId?.toString(),
          );
          if (activity) {
            initialSelections[title] = activity;
          }
        }
      });

      setSelectedActivities(initialSelections);
    }
  }, [eventType, mappings, activities]);

  const handleActivitySelect = (
    mappingName: TypeEnum[number],
    activity: ActivityType | null,
  ) => {
    setSelectedActivities((prev) => ({
      ...prev,
      [mappingName]: activity,
    }));
  };

  const handleSave = () => {
    onSaveMappings(selectedActivities);
  };

  if (!eventType) {
    return <h1>Select an Event type</h1>;
  }

  return (
    <div className="bg-gray-50 p-4">
      <h2 className="mb-4">
        Setup for: {eventType.name} -- {eventType.slug} --{" "}
        {eventType.calUsername}
      </h2>
      {mappingTitles.map((mappingName, index) => (
        <PipedriveMapping
          key={index}
          name={mappingName}
          pipedriveActivities={activities}
          selectedActivity={selectedActivities[mappingName] || null}
          onActivitySelect={(activity) =>
            handleActivitySelect(mappingName, activity)
          }
        />
      ))}
      <button
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Save Mappings
      </button>
    </div>
  );
};
