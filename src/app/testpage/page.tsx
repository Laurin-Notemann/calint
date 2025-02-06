import SetupFrame from "@/components/SetupFrame";
import { SettingsDataRes } from "@/lib/calint-setup";

const settingsData: SettingsDataRes = {
  data: {
    calendlyEventTypes: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000", // Added UUID
        name: "Initial Consultation",
        uri: "https://api.calendly.com/event_types/ABCD1234",
        slug: "initial-consultation",
        scheduleUri: "https://calendly.com/user/initial-consultation",
        calUserUri: "https://api.calendly.com/users/XXXX", // Added required field
        calUsername: "john.doe", // Added required field
        companyId: "550e8400-e29b-41d4-a716-446655440001", // Added required UUID
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "Follow-up Meeting",
        uri: "https://api.calendly.com/event_types/EFGH5678",
        slug: "follow-up-meeting",
        scheduleUri: "https://calendly.com/user/follow-up-meeting",
        calUserUri: "https://api.calendly.com/users/XXXX",
        calUsername: "john.doe",
        companyId: "550e8400-e29b-41d4-a716-446655440001",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        name: "Product Demo",
        uri: "https://api.calendly.com/event_types/IJKL9012",
        slug: "product-demo",
        scheduleUri: "https://calendly.com/user/product-demo",
        calUserUri: "https://api.calendly.com/users/XXXX",
        calUsername: "john.doe",
        companyId: "550e8400-e29b-41d4-a716-446655440001",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440004",
        name: "Technical Support",
        uri: "https://api.calendly.com/event_types/MNOP3456",
        slug: "technical-support",
        scheduleUri: "https://calendly.com/user/technical-support",
        calUserUri: "https://api.calendly.com/users/XXXX",
        calUsername: "john.doe",
        companyId: "550e8400-e29b-41d4-a716-446655440001",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440005",
        name: "Strategy Session",
        uri: "https://api.calendly.com/event_types/QRST7890",
        slug: "strategy-session",
        scheduleUri: "https://calendly.com/user/strategy-session",
        calUserUri: "https://api.calendly.com/users/XXXX",
        calUsername: "john.doe",
        companyId: "550e8400-e29b-41d4-a716-446655440001",
      },
    ],
    pipedriveAcitvityTypes: [
      {
        id: 1,
        order_nr: 1,
        name: "Call",
        key_string: "call",
        icon_key: "call",
        active_flag: true,
        color: "44BB77",
        is_custom_flag: false,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 2,
        order_nr: 2,
        name: "Meeting",
        key_string: "meeting",
        icon_key: "meeting",
        active_flag: true,
        color: "FF7F50",
        is_custom_flag: false,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 3,
        order_nr: 3,
        name: "Email",
        key_string: "email",
        icon_key: "email",
        active_flag: true,
        color: "2196F3",
        is_custom_flag: false,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 4,
        order_nr: 4,
        name: "Task",
        key_string: "task",
        icon_key: "task",
        active_flag: true,
        color: "9C27B0",
        is_custom_flag: false,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 5,
        order_nr: 5,
        name: "Deadline",
        key_string: "deadline",
        icon_key: "deadline",
        active_flag: true,
        color: "F44336",
        is_custom_flag: false,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 6,
        order_nr: 6,
        name: "Follow-up",
        key_string: "follow_up",
        icon_key: "calendar",
        active_flag: true,
        color: "FF9800",
        is_custom_flag: true,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
      {
        id: 7,
        order_nr: 7,
        name: "Demo",
        key_string: "demo",
        icon_key: "presentation",
        active_flag: true,
        color: "4CAF50",
        is_custom_flag: true,
        add_time: "2024-01-15T10:00:00Z",
        update_time: "2024-01-15T10:00:00Z",
      },
    ],
  },
};

const TestPage = () => {
  return (
    <div className="bg-background text-foreground">
      <SetupFrame settingsData={settingsData} />
    </div>
  );
};

export default TestPage;
