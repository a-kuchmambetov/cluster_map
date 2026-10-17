import { AppError } from "@repo/errors";
import type { Actor } from "../auth/auth.types.js";
import type * as adminRepository from "./admin.repository.js";

export type AdminRepository = typeof adminRepository;

export function createAdminService(repository: AdminRepository) {
  async function approveUser(id: string) {
    if (!(await repository.approveUser(id)))
      throw AppError.notFound("User not found or already approved");
    return { message: "Account approved. The user can now log in." };
  }

  async function getUsers(status?: "pending") {
    return { users: await repository.listUsers(status) };
  }

  async function deleteUser(id: string, actor: Actor) {
    if (actor.id === id)
      throw AppError.forbidden("You cannot delete your own account");
    if (!(await repository.deleteUser(id)))
      throw AppError.notFound("User not found");
    return { message: "User deleted" };
  }

  return { approveUser, getUsers, deleteUser };
}

export type AdminService = ReturnType<typeof createAdminService>;
