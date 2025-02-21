"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AppExtensionsSDK from "@pipedrive/app-extensions-sdk";

export const dynamic = "force-dynamic";

function PipedriveFrameContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
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

  return <p>Test</p>;
}

export default function PipedriveFrame() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PipedriveFrameContent />
    </Suspense>
  );
}

