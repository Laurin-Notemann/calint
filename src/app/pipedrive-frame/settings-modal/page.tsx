"use client";

import { useEffect, Suspense } from "react";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";
import { useSearchParams } from "next/navigation";
import { SettingsDataRes } from "@/app/api/v1/settings-modal/route";
import { useQuery } from "@tanstack/react-query";
import SetupFrame from "@/components/SetupFrame";

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
        "https://calint.laurinnotemann.dev/api/v1/settings-modal?userId=" +
          searchParams.get("userId"),
      );

      return res.json();
    },
  });

  useEffect(() => {
    const initializePipedrive = async () => {
      try {
        const sdk = await new AppExtensionsSDK().initialize({
          size: { height: 500, width: 500 },
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
