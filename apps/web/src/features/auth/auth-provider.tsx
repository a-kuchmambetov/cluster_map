import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { AuthUser } from "@repo/types";
import { ApiError, onAccessDenied } from "@/lib/http";
import * as api from "./api";

type State = {
  status:
    | "loading"
    | "authenticated"
    | "anonymous"
    | "two-factor"
    | "error"
    | "forbidden";
  user: AuthUser | null;
};
type Auth = State & {
  refresh: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  verifyTwoFactor: (code: string, trustDevice: boolean) => Promise<void>;
  cancelTwoFactor: () => void;
  setTwoFactorEnabled: (enabled: boolean) => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<State>({ status: "loading", user: null });
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(
    () =>
      onAccessDenied((status) => {
        generation.current++;
        setState({
          status: status === 403 ? "forbidden" : "anonymous",
          user: null,
        });
      }),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setState({ status: "loading", user: null });
    api
      .getSession(controller.signal)
      .then(({ user }) => {
        if (!controller.signal.aborted && current === generation.current)
          setState({ status: "authenticated", user });
        return undefined;
      })
      .catch((error) => {
        if (controller.signal.aborted || current !== generation.current) return;
        setState({
          status:
            error instanceof ApiError && error.status === 401
              ? "anonymous"
              : error instanceof ApiError && error.status === 403
                ? "forbidden"
                : "error",
          user: null,
        });
      });
    return () => {
      controller.abort();
    };
  }, [revision]);
  const signIn = async (email: string, password: string) => {
    const current = ++generation.current;
    const result = await api.login(email, password);
    if (current === generation.current)
      setState(
        "twoFactorRedirect" in result
          ? { status: "two-factor", user: null }
          : { status: "authenticated", user: result.user },
      );
  };
  const verifyTwoFactor = async (code: string, trustDevice: boolean) => {
    const current = ++generation.current;
    const { user } = await api.verifyTOTP(code, trustDevice);
    if (current === generation.current)
      setState({ status: "authenticated", user });
  };
  const signOut = async () => {
    await api.logout();
    generation.current++;
    setState({ status: "anonymous", user: null });
  };
  return (
    <Context.Provider
      value={{
        ...state,
        refresh: () => setRevision((value) => value + 1),
        signIn,
        signOut,
        verifyTwoFactor,
        setTwoFactorEnabled: (enabled) =>
          setState((current) =>
            current.user
              ? {
                  ...current,
                  user: { ...current.user, twoFactorEnabled: enabled },
                }
              : current,
          ),
        cancelTwoFactor: () => {
          generation.current++;
          setState({ status: "anonymous", user: null });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider is required");
  return auth;
}
