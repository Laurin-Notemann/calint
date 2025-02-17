import React from "react";
import { PipedriveActivityType } from "@/db/schema";

type PipeDriveActivityDropdownProps = {
  activities: PipedriveActivityType[];
  selectedActivity: PipedriveActivityType | null;
  onActivitySelect: (activity: PipedriveActivityType | null) => void;
};

export const PipeDriveActivityDropdown: React.FC<
  PipeDriveActivityDropdownProps
> = ({ activities, selectedActivity, onActivitySelect }) => {
  return (
    <select
      value={selectedActivity?.id || ""}
      onChange={(e) => {
        const selected = activities.find((a) => a.id === e.target.value);
        onActivitySelect(selected || null);
      }}
      className="p-2 border rounded"
    >
      <option value="">Select activity</option>
      {activities.map((activity) => (
        <option key={activity.id} value={activity.id}>
          {activity.name}
        </option>
      ))}
    </select>
  );
};
