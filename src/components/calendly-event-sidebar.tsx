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
  return (
    <div className="h-screen overflow-y-auto pr-4">
      <div className="flex flex-col gap-6">
        {eventTypes.map((event, index) => (
          <button
            key={index}
            className={`border-black border rounded p-2 ${selectedEventType?.name === event.name
                ? "bg-blue-500 text-white"
                : ""
              }`}
            onClick={() => onEventTypeSelect(event)}
          >
            {event.name}
          </button>
        ))}
      </div>
    </div>
  );
};

