"use client";
import SetupFrame from "@/components/SetupFrame";
import { SettingsDataRes } from "@/lib/calint-setup";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const TestPageContent = () => {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const {
    isLoading,
    error,
    data: settingsData,
  } = useQuery({
    queryKey: ["settingsData"],
    queryFn: async (): Promise<SettingsDataRes> => {
      const res = await fetch(
        "http://localhost:3000/api/v1/settings-modal?userId=" +
        searchParams.get("userId"),
      );

      return res.json();
    },
  });
  if (!userId) return <>UserId not found</>;

  if (error)
    return (
      <div>Could not get Calendly or Pipedrive information {error.message}</div>
    );

  if (isLoading)
    return <div>Currently fetching Calendly and Pipedrive data</div>;
  return (
    <div className="bg-background text-foreground h-screen">
      <SetupFrame settingsData={settingsData} userId={userId} />
    </div>
  );
};

export default function TestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TestPageContent />
    </Suspense>
  );
}
