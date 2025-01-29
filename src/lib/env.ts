import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PIPEDRIVE_CLIENT_ID: z.string(),
    PIPEDRIVE_CLIENT_SECRET: z.string(),
    PIPEDRIVE_REDIRECT_URL: z.string().url(),
    CALENDLY_CLIENT_ID: z.string(),
    CALENDLY_CLIENT_SECRET: z.string(),
    CALENDLY_REDIRECT_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_CALENDLY_CLIENT_ID: z.string(),
    NEXT_PUBLIC_CALENDLY_REDIRECT_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    PIPEDRIVE_CLIENT_ID: process.env.PIPEDRIVE_CLIENT_ID,
    PIPEDRIVE_CLIENT_SECRET: process.env.PIPEDRIVE_CLIENT_SECRET,
    PIPEDRIVE_REDIRECT_URL: process.env.PIPEDRIVE_REDIRECT_URL,
    CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
    CALENDLY_REDIRECT_URL: process.env.CALENDLY_REDIRECT_URL,
    NEXT_PUBLIC_CALENDLY_CLIENT_ID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID,
    NEXT_PUBLIC_CALENDLY_REDIRECT_URL:
      process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URL,
  },
});
