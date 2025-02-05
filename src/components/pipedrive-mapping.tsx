import { ActivityType } from "pipedrive/v1";
import { PipeDriveActivityDropdown } from "./pipedrive-activity-dropdown";

type PipedriveMappingProps = {
  name: string;
  pipedriveActivities: ActivityType[];
  selectedActivity: ActivityType | null;
  onActivitySelect: (activity: ActivityType) => void;
};

export const PipedriveMapping: React.FC<PipedriveMappingProps> = ({
  name,
  pipedriveActivities,
  selectedActivity,
  onActivitySelect,
}) => {
  return (
    <div className="flex">
      <h3>{name}</h3>
      <PipeDriveActivityDropdown
        activities={pipedriveActivities}
        selectedActivity={selectedActivity}
        onActivitySelect={onActivitySelect}
      />
    </div>
  );
};
