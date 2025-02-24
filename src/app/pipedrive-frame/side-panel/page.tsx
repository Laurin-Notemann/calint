"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import { JsonPanel } from "@/app/api/v1/jsonpipedrive/route";
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
        throw new Error("Network response was not ok");
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
    onSuccess: (_, variables) => {
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["settingsData", userId, dealId],
        });
      }, 0.5);
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
    return <div className="text-red-500 font-semibold">UserId not found</div>;
  if (!dealId)
    return <div className="text-red-500 font-semibold">DealId not found</div>;

  if (error)
    return <div className="">Could not get any data: {error.message}</div>;

  if (isLoading)
    return <div className="">Currently fetching Pipedrive Activities...</div>;

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
              className="flex flex-col items-start  gap-2 p-4 rounded-lg"
            >
              <h2 className="font-semibold text-lg ">{activity.header}</h2>
              <div className="flex flex-wrap gap-2 items-center">
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
        <div className="">No activities available</div>
      )}
    </div>
  );
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}
