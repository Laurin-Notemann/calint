import { EventType } from "@/lib/calendly-client";

type CalendlyEventSidebarProps = {
  eventTypes: EventType[];
  onEventTypeSelect: (eventType: EventType) => void;
  selectedEventType: EventType | null;
};

export const CalendlyEventSidebar: React.FC<CalendlyEventSidebarProps> = ({
  eventTypes,
  onEventTypeSelect,
  selectedEventType,
}) => {
  return (
    <>
      <div className="flex flex-col gap-6">
        {eventTypes.map((event, index) => (
          <button
            key={index}
            className={`border-black border rounded p-2 ${
              selectedEventType?.name === event.name
                ? "bg-blue-500 text-white"
                : ""
            }`}
            onClick={() => onEventTypeSelect(event)}
          >
            {event.name}
          </button>
        ))}
      </div>
    </>
  );
};
