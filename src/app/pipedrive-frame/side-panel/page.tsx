"use client";
import { FC, Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import {
  JsonPanel,
  JsonPanelData,
  JsonPanelError,
} from "@/app/api/v1/jsonpipedrive/route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/env";
import ArrowDown from "public/triangle-down-svgrepo-com(1).svg";
import LinkIcon from "public/external-link-svgrepo-com.svg";

export const dynamic = "force-dynamic";

export type ShowMutation = {
  activityId: number;
  dealId: number;
  userId: number;
  show: boolean;
  typeKeyString: string;
  isDb: boolean;
};

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const [localState, setLocalState] = useState<{
    [key: number]: {
      status: "success" | "error" | null;
      action?: "show" | "noshow";
    };
  }>({});
  const [dropdownOpen, setDropdownOpen] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userId = searchParams.get("userId");
  const dealId = searchParams.get("selectedIds");

  const queryClient = useQueryClient();

  const { isLoading, error, data } = useQuery({
    queryKey: ["settingsData", userId, dealId],
    queryFn: async (): Promise<JsonPanel> => {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BASE_URL}/api/v1/jsonpipedrive?userId=${userId}&selectedIds=${dealId}`,
      );
      if (!res.ok) {
        const err: JsonPanelError = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    enabled: !!userId && !!dealId,
  });

  const { mutate } = useMutation({
    mutationFn: (input: ShowMutation) => {
      return fetch(env.NEXT_PUBLIC_BASE_URL + "/api/v1/show/update", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onMutate: async (newActivity) => {
      setLocalState((prev) => ({
        ...prev,
        [newActivity.activityId]: {
          status: "success",
          action: newActivity.show ? "show" : "noshow",
        },
      }));
    },
    onError: (err, newActivity) => {
      setLocalState((prev) => ({
        ...prev,
        [newActivity.activityId]: { status: "error" },
      }));
      console.error("Mutation error:", err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["settingsData", userId, dealId],
      });
    },
  });

  useEffect(() => {
    const initializePipedrive = async () => {
      try {
        await new AppExtensionsSDK().initialize({});
      } catch (error) {
        console.error("Failed to initialize Pipedrive SDK:", error);
      }
    };

    initializePipedrive();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = (activityId: number) => {
    setActiveDropdown((prevActiveDropdown) =>
      prevActiveDropdown === activityId ? null : activityId,
    );
  };

  const hasLinks = (activity: JsonPanelData) => {
    return (
      activity.join_meeting ||
      activity.cancel_meeting ||
      activity.reschedule_meeting
    );
  };

  if (!userId) return <TextMiddle content={"UserId not found"} />;

  if (!dealId) return <TextMiddle content={"DealId not found"} />;

  if (error)
    return (
      <TextMiddle
        content={"Could not get any data: " + JSON.stringify(error)}
      />
    );

  if (isLoading)
    return <TextMiddle content="Currently fetching Pipedrive Activities..." />;

  return (
    <div className="space-y-4">
      {data && data.data.length > 0 ? (
        data.data.map((activity, index) => {
          const activityState = localState[activity.id];
          const isDropdownOpen = activeDropdown === activity.id;

          return (
            <div key={index} className="flex flex-row justify-center gap-2 p-4">
              <h2 className="font-semibold text-lg">{activity.header}</h2>
              <div className="flex gap-2 items-center">
                {activityState?.status === "success" ? (
                  <div className="h-10 p-1 px-3 font-semibold bg-foreground text-pipedrive-general-primary-text rounded">
                    Item set to {activityState.action}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        mutate({
                          activityId: activity.id,
                          dealId: parseInt(dealId),
                          userId: parseInt(userId),
                          show: true,
                          typeKeyString: activity.typeKeyString,
                          isDb: activity.isDb,
                        })
                      }
                      className="h-8 p-1.5 px-3.5 text-sm font-semibold bg-pipedrive-button-green text-pipedrive-button-text rounded hover:bg-pipedrive-button-green-hover transition"
                      disabled={!!activeDropdown}
                    >
                      Show
                    </button>
                    <button
                      onClick={() =>
                        mutate({
                          activityId: activity.id,
                          dealId: parseInt(dealId),
                          userId: parseInt(userId),
                          show: false,
                          typeKeyString: activity.typeKeyString,
                          isDb: activity.isDb,
                        })
                      }
                      className="h-8 p-1.5 px-3.5 text-sm font-semibold bg-pipedrive-button-red text-pipedrive-button-text rounded hover:bg-pipedrive-button-red-hover transition"
                      disabled={!!activeDropdown}
                    >
                      No-Show
                    </button>
                    {hasLinks(activity) && (
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => toggleDropdown(activity.id)}
                          className="h-8 w-8 border flex justify-center border-pipedrive-dropdown-button-border rounded hover:bg-pipedrive-dropdown-button-hover transition"
                        >
                          <ArrowDown className="w-2 h-2 fill-pipedrive-general-primary-text self-center text-center" />
                        </button>
                        {isDropdownOpen && (
                          <div className="absolute right-0 mt-2 p-1.5 bg-pipedrive-dropdown-menu-background rounded shadow-[0_0_10px_rgba(0,0,0,0.2)] z-20">
                            {activity.join_meeting && (
                              <DropdownExternalLinkItem
                                name="Join"
                                link={activity.join_meeting}
                              />
                            )}
                            {activity.cancel_meeting && (
                              <DropdownExternalLinkItem
                                name="Cancel"
                                link={activity.cancel_meeting}
                              />
                            )}
                            {activity.reschedule_meeting && (
                              <DropdownExternalLinkItem
                                name="Reschedule"
                                link={activity.reschedule_meeting}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {activityState?.status === "error" && (
                  <span className="text-red-500 text-xl">✗</span>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <TextMiddle content="No activities available" />
      )}
    </div>
  );
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<TextMiddle content="Loading..." />}>
      <PipedriveFrameContent />
    </Suspense>
  );
}

type TextMiddleProps = {
  content: string;
};

const TextMiddle: FC<TextMiddleProps> = ({ content }) => {
  return (
    <div className="flex flex-col mt-5">
      <p className="text-lg self-center">{content}</p>
    </div>
  );
};

type DropwdownExternalLinkItemProps = {
  name: string;
  link: string;
};

const DropdownExternalLinkItem: FC<DropwdownExternalLinkItemProps> = ({
  name,
  link,
}) => {
  return (
    <div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex justify-between items-center px-2 py-1.5 gap-2 text-sm hover:bg-pipedrive-dropdown-item-hover hover:text-white rounded"
      >
        <p>{name}</p>
        <LinkIcon className="w-4 h-4 flex-shrink-0 " />
      </a>
    </div>
  );
};
