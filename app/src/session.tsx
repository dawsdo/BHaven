import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

type StaffSession = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const STORAGE_KEY = "openbeds.staffToken";

// On the web the token is kept in sessionStorage, so a page reload does not sign staff out.
// It is cleared when the tab closes. On a phone it lives in memory until the app closes.
function readStoredToken(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode). The in-memory session still works.
  }
}

const SessionContext = createContext<StaffSession | null>(null);

/** Holds the staff session above the screens, so moving between screens does not sign staff out. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(readStoredToken);

  const setToken = useCallback((next: string | null) => {
    writeStoredToken(next);
    setTokenState(next);
  }, []);

  const value = useMemo(() => ({ token, setToken }), [token, setToken]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useStaffSession(): StaffSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useStaffSession must be used inside SessionProvider.");
  return session;
}
