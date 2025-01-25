'use server'
import { headers } from 'next/headers';

export default async function ErrorPage() {
  const headersList = headers();
  const errorMsg = headersList.get('error-msg');

  console.log('Error: ', errorMsg)
  console.log('headers: ', headersList)

  return (
    <div>
      {errorMsg || 'Could not use OAuth to login with Pipedrive'}
    </div>
  );
}

