import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@repo/db";
import {
  approveUser,
  deleteUser,
  listUsers,
} from "../../../../src/features/admin/admin.repository.js";

afterEach(() => vi.restoreAllMocks());

describe("admin PostgreSQL query contract without a database", () => {
  it("approves in one conditional UPDATE by opaque ID, without a token or pre-read", async () => {
    const query = vi
      .spyOn(db.$client, "query")
      .mockImplementation(async () => ({ rows: [["opaque-id"]] }));
    expect(await approveUser("opaque-id")).toEqual({ id: "opaque-id" });
    expect(query).toHaveBeenCalledOnce();
    const [statement, params] = query.mock.calls[0];
    expect(statement).toMatchObject({
      text: 'update "user" set "approved" = $1, "updated_at" = $2 where ("user"."id" = $3 and "user"."approved" = $4) returning "id"',
    });
    expect(params).toEqual([true, expect.any(String), "opaque-id", false]);
  });

  it.each([undefined, "pending"] as const)(
    "lists only explicit admin fields with status=%s",
    async (status) => {
      const query = vi
        .spyOn(db.$client, "query")
        .mockImplementation(async () => ({ rows: [] }));
      expect(await listUsers(status)).toEqual([]);
      const [statement, params] = query.mock.calls[0];
      expect(statement).toMatchObject({
        text: `select "id", "name", "email", "role", "approved", "created_at" from "user"${status ? ' where "user"."approved" = $1' : ""} order by "user"."name" asc, "user"."id" asc`,
      });
      expect(params).toEqual(status ? [false] : []);
    },
  );

  it("leaves deletion cascades to the database and reports no match", async () => {
    const query = vi
      .spyOn(db.$client, "query")
      .mockImplementation(async () => ({ rows: [] }));
    expect(await deleteUser("missing")).toBeUndefined();
    expect(query).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        text: 'delete from "user" where "user"."id" = $1 returning "id"',
      }),
      ["missing"],
    );
  });
});
