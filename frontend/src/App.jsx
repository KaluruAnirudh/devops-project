import { startTransition, useEffect, useMemo, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";

const getInitialRoute = () => {
  const path = window.location.pathname;
  return path === "/register" ? "register" : "login";
};

const syncRoute = (route) => {
  const nextPath = route === "register" ? "/register" : route === "dashboard" ? "/dashboard" : "/";
  window.history.pushState({}, "", nextPath);
};

export default function App() {
  const auth = useAuth();
  const [route, setRoute] = useState(() => (auth.isAuthenticated ? "dashboard" : getInitialRoute()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handlePopState = () => {
      setRoute(auth.isAuthenticated ? "dashboard" : getInitialRoute());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [auth.isAuthenticated]);

  const page = useMemo(() => {
    if (auth.loading) {
      return <div className="loading-screen">Loading platform session...</div>;
    }

    if (auth.isAuthenticated) {
      if (route !== "dashboard") {
        syncRoute("dashboard");
      }

      return (
        <DashboardPage
          token={auth.token}
          user={auth.user}
          onUserRefresh={async (nextUser) => {
            if (nextUser) {
              auth.setUser(nextUser);
              return nextUser;
            }

            return auth.refresh();
          }}
          onLogout={() => {
            auth.logout();
            setRoute("login");
            syncRoute("login");
          }}
        />
      );
    }

    if (route === "register") {
      return (
        <RegisterPage
          busy={busy}
          error={error}
          onSwitch={() => {
            startTransition(() => {
              setError("");
              setRoute("login");
              syncRoute("login");
            });
          }}
          onSubmit={async (form) => {
            setBusy(true);
            setError("");

            try {
              await auth.register(form);
              setRoute("dashboard");
              syncRoute("dashboard");
            } catch (submitError) {
              setError(submitError.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      );
    }

    return (
      <LoginPage
        busy={busy}
        error={error}
        onSwitch={() => {
          startTransition(() => {
            setError("");
            setRoute("register");
            syncRoute("register");
          });
        }}
        onSubmit={async (form) => {
          setBusy(true);
          setError("");

          try {
            await auth.login(form);
            setRoute("dashboard");
            syncRoute("dashboard");
          } catch (submitError) {
            setError(submitError.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }, [auth, busy, error, route]);

  return page;
}
