import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { initializeSession } from '@/lib/oauth';

export default async function Home({
  searchParams,
}: {
  searchParams: { userId?: string };
}) {
//  const cookieStore = cookies();
//  const session = await initializeSession( searchParams.userId);
//
//  if (!session.auth) {
//    redirect('/login');
//  }

  return <div>Hello</div>;
} 