'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCookie } from 'cookies-next';

export default function CalendlyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');

    const pipedriveId = getCookie('userId');

    console.log(code);
    console.log(pipedriveId);
    
    if (code && pipedriveId) {
      const backendUrl = `/api/v1/auth/calendly/callback?code=${code}&pipedriveid=${pipedriveId}`;

      router.push(backendUrl);
    } else {
      router.push('/error');
    }
  }, [router, searchParams]);

  return null;
}
