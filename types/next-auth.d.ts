import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    masterKeyB64?: string;
  }

  interface User {
    masterKeyB64?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    masterKeyB64?: string;
  }
}
