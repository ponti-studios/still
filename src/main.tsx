import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getSessionUser, redirectToLogin, type AuthUser } from './auth';
import './style.css';

function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    getSessionUser().then((u) => (u ? setUser(u) : redirectToLogin()));
  }, []);
  return user ? <App user={user} /> : null;
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthGate /></StrictMode>);
