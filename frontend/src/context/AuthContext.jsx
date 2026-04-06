import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);
const storageKey = "forgeops-session";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(storageKey)));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      localStorage.removeItem(storageKey);
      return;
    }

    localStorage.setItem(storageKey, token);
    setLoading(true);

    api
      .me(token)
      .then(({ user: profile }) => {
        startTransition(() => {
          setUser(profile);
          setLoading(false);
        });
      })
      .catch(() => {
        localStorage.removeItem(storageKey);
        setToken("");
        setUser(null);
        setLoading(false);
      });
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      async login(form) {
        const session = await api.login(form);
        setToken(session.token);
        setUser(session.user);
        return session;
      },
      async register(form) {
        const session = await api.register(form);
        setToken(session.token);
        setUser(session.user);
        return session;
      },
      async refresh() {
        if (!token) {
          return null;
        }

        const session = await api.me(token);
        setUser(session.user);
        return session.user;
      },
      logout() {
        localStorage.removeItem(storageKey);
        setToken("");
        setUser(null);
      },
      setUser
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

