import React from "react";
import { ActivityType } from "pipedrive/v1";

type PipeDriveActivityDropdownProps = {
  activities: ActivityType[];
  selectedActivity: ActivityType | null;
  onActivitySelect: (activity: ActivityType | null) => void;
};

export const PipeDriveActivityDropdown: React.FC<
  PipeDriveActivityDropdownProps
> = ({ activities, selectedActivity, onActivitySelect }) => {
  return (
    <select
      value={selectedActivity?.id?.toString() || ""}
      onChange={(e) => {
        const selectedId = parseInt(e.target.value, 10);
        const selected = activities.find((a) => a.id === selectedId);
        onActivitySelect(selected || null);
      }}
      className="p-2 border rounded"
    >
      <option value="">Select activity</option>
      {activities.map((activity) => (
        <option key={activity.id} value={activity.id?.toString()}>
          {activity.name}
        </option>
      ))}
    </select>
  );
};
