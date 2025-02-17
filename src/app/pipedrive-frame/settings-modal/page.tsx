"use client";

import { useEffect, Suspense } from "react";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import SetupFrame from "@/components/SetupFrame";
import { SettingsDataRes } from "@/lib/calint-setup";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const {
    isLoading,
    error,
    data: settingsData,
  } = useQuery({
    queryKey: ["settingsData"],
    queryFn: async (): Promise<SettingsDataRes> => {
      const res = await fetch(
        env.BASE_URL +
          "/api/v1/settings-modal?userId=" +
          searchParams.get("userId"),
      );

      return res.json();
    },
  });

  useEffect(() => {
    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize({
          size: { height: 1000, width: 1000 },
        });
        const settings = sdk.userSettings;
        console.log("Pipedrive context:", settings);
      } catch (error) {
        console.error("Failed to initialize Pipedrive SDK:", error);
      }
    };

    initializePipedrive();
  }, [searchParams]);

  if (error)
    return (
      <div>Could not get Calendly or Pipedrive information {error.message}</div>
    );

  if (isLoading)
    return <div>Currently fetching Calendly and Pipedrive data</div>;

  return <SetupFrame settingsData={settingsData} />;
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}
