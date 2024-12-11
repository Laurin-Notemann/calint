import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection string should be in your environment variables
const connectionString = process.env.DATABASE_URL;

// Create the connection
const client = postgres(connectionString);

// Create the drizzle database instance
const db = drizzle(client, { schema });

export default db; 