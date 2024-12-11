import { type Config } from "drizzle-kit";
import { config } from "dotenv";

config();

export default {
  schema: ["./src/db/schema.ts"],
  dialect: "postgresql",
  out: "./drizzle",

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
