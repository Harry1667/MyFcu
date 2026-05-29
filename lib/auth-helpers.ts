import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export interface ResolvedSession {
  userId: string;
  email: string | null | undefined;
  masterKey: Buffer;
}

export async function requireSession(): Promise<ResolvedSession> {
  const session = await auth();
  if (!session?.user?.id || !session.masterKeyB64) {
    redirect('/login');
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    masterKey: Buffer.from(session.masterKeyB64, 'base64'),
  };
}
