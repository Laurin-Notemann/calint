"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import { JsonPanel } from "@/app/api/v1/jsonpipedrive/route";
import { useMutation, useQuery } from "@tanstack/react-query";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export type ShowMutation = {
  activityId: number;
  dealId: number;
  userId: number;
  show: boolean;
};

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const {
    isPending,
    isError,
    isSuccess,
    error: errorShow,
    mutate,
  } = useMutation({
    mutationFn: (input: ShowMutation) => {
      return fetch(env.NEXT_PUBLIC_BASE_URL + "/api/v1/show/update", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
  const userId = searchParams.get("userId");
  const dealId = searchParams.get("selectedIds");
  const { isLoading, error, data } = useQuery({
    queryKey: ["settingsData"],
    queryFn: async (): Promise<JsonPanel> => {
      const res = await fetch(
        env.NEXT_PUBLIC_BASE_URL +
          "/api/v1/jsonpipedrive?userId=" +
          userId +
          "&selectedIds=" +
          dealId,
      );

      return res.json();
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
  }, [searchParams]);

  if (!userId) return <>UserId not found</>;
  if (!dealId) return <>DealId not found</>;

  if (error) return <div>Could not get any data: {error.message}</div>;

  if (isLoading) return <div>Currently fetching Pipedrive Activities</div>;

  return (
    <>
      {data ? (
        <>
          {data.data.map((activity, index) => (
            <div key={index} className="flex gap-2">
              <h2>{activity.header}</h2>
              <a href={activity.join_meeting}>Join</a>
              <a href={activity.cancel_meeting}>Cancel</a>
              <a href={activity.reschedule_meeting}>Reschedule</a>
              <button
                onClick={() =>
                  mutate({
                    activityId: activity.id,
                    dealId: parseInt(dealId),
                    userId: parseInt(userId),
                    show: true,
                  })
                }
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
                  })
                }
              >
                No-Show
              </button>
            </div>
          ))}
        </>
      ) : (
        <div>Error</div>
      )}
    </>
  );
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}
