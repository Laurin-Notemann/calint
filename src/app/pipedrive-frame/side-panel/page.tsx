"use client";
import { FC, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import { JsonPanel, JsonPanelError } from "@/app/api/v1/jsonpipedrive/route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/env";

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
        const err: JsonPanelError = await res.json()
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

  if (!userId)
    return <TextMiddle content={"UserId not found"} />;

  if (!dealId)
    return <TextMiddle content={"DealId not found"} />;

  if (error)
    return <TextMiddle content={"Could not get any data: " + JSON.stringify(error)} />;

  if (isLoading)
    return <TextMiddle content="Currently fetching Pipedrive Activities..." />;

  return (
    <div className="space-y-4">
      {data && data.data.length > 0 ? (
        data.data.map((activity, index) => {
          const activityState = localState[activity.id];

          if (activityState?.status === "success") {
            return (
              <div key={index} className="p-4 rounded-lg">
                Item successfully set to {activityState.action}
              </div>
            );
          }

          return (
            <div
              key={index}
              className="flex flex-row justify-center gap-2 p-4"
            >
              <h2 className="font-semibold text-lg">{activity.header}</h2>
              <div className="flex gap-2 items-center">
                {activity.join_meeting && (
                  <a
                    href={activity.join_meeting}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Join
                  </a>
                )}
                {activity.cancel_meeting && (
                  <a
                    href={activity.cancel_meeting}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Cancel
                  </a>
                )}
                {activity.reschedule_meeting && (
                  <a
                    href={activity.reschedule_meeting}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Reschedule
                  </a>
                )}
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
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
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
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600  transition"
                >
                  No-Show
                </button>
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
    <Suspense fallback={<TextMiddle content="Loading..."/>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}

type TextMiddleProps = {
  content: string;
}

const TextMiddle: FC<TextMiddleProps> = ({ content }) => {
  return (
    <div className="flex flex-col mt-5">
      <p className="text-lg self-center">{content}</p>
    </div>
  )
}
