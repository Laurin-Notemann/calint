import React from "react";
import { ActivityType } from "pipedrive/v1";
import { PipeDriveActivityDropdown } from "./pipedrive-activity-dropdown";
import { TypeEnum } from "@/db/schema";

type PipedriveMappingProps = {
  name: TypeEnum[number];
  pipedriveActivities: ActivityType[];
  selectedActivity: ActivityType | null;
  onActivitySelect: (activity: ActivityType | null) => void;
};

export const PipedriveMapping: React.FC<PipedriveMappingProps> = ({
  name,
  pipedriveActivities,
  selectedActivity,
  onActivitySelect,
}) => {
  return (
    <div className="flex items-center mb-4">
      <h3 className="w-32">{name}</h3>
      <PipeDriveActivityDropdown
        activities={pipedriveActivities}
        selectedActivity={selectedActivity}
        onActivitySelect={onActivitySelect}
      />
    </div>
  );
};
