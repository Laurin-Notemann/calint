namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    NEXT_PUBLIC_API_URL: string;
    PIPEDRIVE_API_TOKEN: string;
    JWT_SECRET: string;
    SOCKET_URL: string;
    DATABASE_URL: string;
    // Add any other environment variables you use
  }
} 