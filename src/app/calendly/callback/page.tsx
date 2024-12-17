'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCookie } from 'cookies-next';

export const dynamic = 'force-dynamic';

function CalendlyRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const pipedriveId = getCookie('userId');

    if (code && pipedriveId) {
      const backendUrl = `/api/v1/auth/calendly/callback?code=${code}&pipedriveid=${pipedriveId}`;
      router.push(backendUrl);
    } else {
      router.push('/error');
    }
  }, [router, searchParams]);

  return null;
}

export default function CalendlyRedirect() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CalendlyRedirectContent />
    </Suspense>
  );
}

