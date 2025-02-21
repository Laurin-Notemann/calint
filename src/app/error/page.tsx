"use server";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const errorMsg = searchParams["error-msg"];
  console.log("Error from params:", JSON.stringify(errorMsg));

  return <div>{errorMsg || "Could not use OAuth to login with Pipedrive"}</div>;
}
