import { authenticatedHandler } from "../../middleware/actor.js";
import { userIdParamsSchema, usersQuerySchema } from "./admin.schema.js";
import type { AdminService } from "./admin.service.js";

export function createAdminController(service: AdminService) {
  return {
    usersHandler: authenticatedHandler(
      { query: usersQuerySchema },
      async ({ query }, res) => {
        res.json(await service.getUsers(query.status));
      },
    ),
    approveUserHandler: authenticatedHandler(
      { params: userIdParamsSchema },
      async ({ params }, res) => {
        res.json(await service.approveUser(params.id));
      },
    ),
    deleteUserHandler: authenticatedHandler(
      { params: userIdParamsSchema },
      async ({ params, actor }, res) => {
        res.json(await service.deleteUser(params.id, actor));
      },
    ),
  };
}
