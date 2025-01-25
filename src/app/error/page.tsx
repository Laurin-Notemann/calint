import { headers } from 'next/headers';

export default function ErrorPage() {
  const headersList = headers();
  const errorMsg = headersList.get('error-msg');

  console.log('Error: ', errorMsg)

  return (
    <div>
      {errorMsg || 'Could not use OAuth to login with Pipedrive'}
    </div>
  );
}

