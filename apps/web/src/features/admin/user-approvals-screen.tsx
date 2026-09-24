import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import type { AdminUser } from "@repo/types";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { useAuth } from "@/features/auth/auth-provider";
import { approveUser, deleteUser, getUsers } from "./api";

export function UserApprovalsScreen() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <UserApprovals />;
}

function UserApprovals() {
  const { user: actor } = useAuth();
  const [filter, setFilter] = useState("");
  const [unapprovedOnly, setUnapprovedOnly] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
    getUsers(controller.signal)
      .then(({ users }) => {
        if (!controller.signal.aborted) setUsers(users);
        return undefined;
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Unable to load users. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  const approve = async (user: AdminUser) => {
    if (!user.approvalToken || busy.current) return;
    busy.current = true;
    setApproving(user.id);
    setError("");
    setMessage("");
    try {
      await approveUser(user.approvalToken);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, approved: true, approvalToken: null }
            : item,
        ),
      );
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

  const remove = async (user: AdminUser) => {
    if (
      busy.current ||
      !window.confirm(
        `Delete ${user.name} (${user.email})? This permanently removes the account and its sessions.`,
      )
    )
      return;
    busy.current = true;
    setDeleting(user.id);
    setError("");
    setMessage("");
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage(`${user.name} has been deleted.`);
    } catch {
      setError(`Unable to delete ${user.name}. Try again or refresh the list.`);
    } finally {
      busy.current = false;
      setDeleting(null);
    }
  };
  const query = filter.trim().toLocaleLowerCase();
  const visibleUsers = users.filter(
    (user) =>
      (!unapprovedOnly || !user.approved) &&
      (user.name.toLocaleLowerCase().includes(query) ||
        user.email.toLocaleLowerCase().includes(query)),
  );
  const mutating = approving !== null || deleting !== null;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-secondary">
            Administration
          </p>
          <h1 className="mt-2 text-display-xs font-semibold text-primary">
            Users
          </h1>
          <p className="mt-2 text-md text-tertiary">
            Manage accounts and approve access to the cluster map.
          </p>
        </div>
        <Button
          color="secondary"
          isDisabled={loading || mutating}
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
      <label className="flex flex-col gap-2 text-sm font-medium text-primary">
        Filter by name or email
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search users..."
          className="rounded-lg border border-secondary bg-primary px-3 py-2 text-primary shadow-xs"
        />
      </label>
      <Checkbox
        label="Unapproved users only"
        isSelected={unapprovedOnly}
        onChange={setUnapprovedOnly}
      />
      <section
        aria-label="Users"
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs"
      >
        <div className="border-b border-secondary px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">
            Users{!loading && !error && ` (${visibleUsers.length})`}
          </h2>
        </div>
        {loading ? (
          <p role="status" className="p-6 text-tertiary">
            Loading users...
          </p>
        ) : visibleUsers.length === 0 ? (
          !error && (
            <div className="px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-primary">
                {query || unapprovedOnly ? "No matching users" : "No users"}
              </h3>
              <p className="mt-2 text-tertiary">
                {query
                  ? "Try a different name or email."
                  : unapprovedOnly
                    ? "There are no users awaiting approval."
                    : "There are no registered users."}
              </p>
            </div>
          )
        ) : (
          <ul className="divide-y divide-secondary">
            {visibleUsers.map((user) => (
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
                    {user.role === "admin" ? "Admin" : "User"} ·{" "}
                    {user.approved ? "Approved" : "Pending approval"} ·
                    Registered {new Date(user.createdAt).toLocaleString()}
                  </p>
                  {!user.approved && !user.approvalToken && (
                    <p className="mt-1 text-sm text-error-primary">
                      Approval is unavailable because this account has no
                      approval token.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!user.approved && (
                    <Button
                      aria-label={`Approve ${user.name}`}
                      isDisabled={mutating || !user.approvalToken}
                      isLoading={approving === user.id}
                      onClick={() => void approve(user)}
                    >
                      Approve user
                    </Button>
                  )}
                  <Button
                    color="secondary-destructive"
                    aria-label={`Delete ${user.name}`}
                    isDisabled={mutating || user.id === actor?.id}
                    isLoading={deleting === user.id}
                    onClick={() => void remove(user)}
                  >
                    Delete user
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
