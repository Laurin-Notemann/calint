import { ActivityType } from "@/app/api/v1/settings-modal/route";
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
