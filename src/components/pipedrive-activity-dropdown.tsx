import { ActivityType } from "@/app/api/v1/settings-modal/route";

type PipeDriveActivityDropdownProps = {
  activities: ActivityType[];
  selectedActivity: ActivityType | null;
  onActivitySelect: (activity: ActivityType) => void;
};

export const PipeDriveActivityDropdown: React.FC<
  PipeDriveActivityDropdownProps
> = ({ activities, selectedActivity, onActivitySelect }) => {
  return (
    <select
      value={selectedActivity?.name || ""}
      onChange={(e) => {
        const selected = activities.find((a) => a.name === e.target.value);
        if (selected) {
          onActivitySelect(selected);
        }
      }}
      className="p-2 border rounded"
    >
      <option value="">Select activity</option>
      {activities.map((activity, index) => (
        <option key={index} value={activity.name}>
          {activity.name}
        </option>
      ))}
    </select>
  );
};
