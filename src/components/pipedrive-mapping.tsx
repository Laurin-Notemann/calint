import React from "react";
import { PipeDriveActivityDropdown } from "./pipedrive-activity-dropdown";
import { PipedriveActivityType, TypeEnum } from "@/db/schema";

type PipedriveMappingProps = {
  name: TypeEnum[number];
  pipedriveActivities: PipedriveActivityType[];
  selectedActivity: PipedriveActivityType | null;
  onActivitySelect: (activity: PipedriveActivityType | null) => void;
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
