import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { AuthContext, useAuthProvider } from './hooks/useAuth';

function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
