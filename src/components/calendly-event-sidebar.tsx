import React, { useState } from "react";
import { CalEventType } from "@/db/schema";

type CalendlyEventSidebarProps = {
  eventTypes: CalEventType[];
  onEventTypeSelect: (eventType: CalEventType) => void;
  selectedEventType: CalEventType | null;
};

export const CalendlyEventSidebar: React.FC<CalendlyEventSidebarProps> = ({
  eventTypes,
  onEventTypeSelect,
  selectedEventType,
}) => {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  return (
    <div className="h-screen overflow-y-auto pr-4 pt-7">
      <div className="flex flex-col gap-6">
        {eventTypes.map((event) => (
          <div key={event.id} className="relative">
            <button
              className={`w-full border border-black rounded p-2 ${
                selectedEventType?.id === event.id
                  ? "bg-blue-500 text-white"
                  : "bg-white text-black"
              }`}
              onClick={() => onEventTypeSelect(event)}
              onMouseEnter={() => setHoveredEventId(event.id)}
              onMouseLeave={() => setHoveredEventId(null)}
            >
              {event.name} -- {event.slug}
            </button>
            <div
              className={`absolute left-0 bottom-full bg-gray-800 text-white py-1 px-2 rounded text-sm transition-opacity duration-150 ${
                hoveredEventId === event.id
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              Name: {event.calUsername}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
