import { env } from "@/lib/env";
import Link from "next/link";

export default function ToPipedrive() {
  return (
    <>
      <Link
        href={`https://auth.calendly.com/oauth/authorize?client_id=${env.NEXT_PUBLIC_CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=${env.NEXT_PUBLIC_CALENDLY_REDIRECT_URL}`}
      >
        Calendly signin
      </Link>
      <Link href={"https://company.pipedrive.com"}>Go to Pipdrive</Link>
    </>
  );
}
