import Link from "next/link";

export default function Success() {
  return (
    <div className="flex flex-col gap-10 mt-20">
      <h1 className="text-2xl self-center">
        You have successfully signed signed up with you Pipedrive and Calendly
        Account
      </h1>
      <Link
        className="text-lg self-center bg-green-600 p-2 rounded"
        href={"https://company.pipedrive.com"}
      >
        Go Back to Pipedrive
      </Link>
    </div>
  );
}
