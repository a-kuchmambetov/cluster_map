import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import type { PendingUser } from "@repo/types";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "@/features/auth/auth-provider";
import { approveUser, getPendingUsers } from "./api";

export function UserApprovalsScreen() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <UserApprovals />;
}

function UserApprovals() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const busy = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getPendingUsers(controller.signal)
      .then(({ users }) => {
        if (!controller.signal.aborted) setUsers(users);
        return undefined;
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load pending users. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  const approve = async (user: PendingUser) => {
    if (!user.approvalToken || busy.current) return;
    busy.current = true;
    setApproving(user.id);
    setError("");
    setMessage("");
    try {
      await approveUser(user.approvalToken);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage(`${user.name} has been approved and can now sign in.`);
    } catch {
      setError(
        `Unable to approve ${user.name}. Try again or refresh the list.`,
      );
    } finally {
      busy.current = false;
      setApproving(null);
    }
  };

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-secondary">
            Administration
          </p>
          <h1 className="mt-2 text-display-xs font-semibold text-primary">
            User approvals
          </h1>
          <p className="mt-2 text-md text-tertiary">
            Review new registrations and approve access to the cluster map.
          </p>
        </div>
        <Button
          color="secondary"
          isDisabled={loading || approving !== null}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-secondary p-4 text-sm text-primary"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-secondary p-4 text-sm text-error-primary"
        >
          {error}
        </p>
      )}
      <section
        aria-label="Pending registrations"
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs"
      >
        <div className="border-b border-secondary px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">
            Pending users{!loading && !error && ` (${users.length})`}
          </h2>
        </div>
        {loading ? (
          <p role="status" className="p-6 text-tertiary">
            Loading pending users...
          </p>
        ) : users.length === 0 ? (
          !error && (
            <div className="px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-primary">
                All caught up
              </h3>
              <p className="mt-2 text-tertiary">
                There are no users awaiting approval.
              </p>
            </div>
          )
        ) : (
          <ul className="divide-y divide-secondary">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold break-words text-primary">
                    {user.name}
                  </h3>
                  <p className="text-sm break-all text-tertiary">
                    {user.email}
                  </p>
                  <p className="mt-1 text-sm text-tertiary">
                    Registered {new Date(user.createdAt).toLocaleString()}
                  </p>
                  {!user.approvalToken && (
                    <p className="mt-1 text-sm text-error-primary">
                      Approval is unavailable because this account has no
                      approval token.
                    </p>
                  )}
                </div>
                <Button
                  aria-label={`Approve ${user.name}`}
                  isDisabled={approving !== null || !user.approvalToken}
                  isLoading={approving === user.id}
                  onClick={() => void approve(user)}
                >
                  Approve user
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
