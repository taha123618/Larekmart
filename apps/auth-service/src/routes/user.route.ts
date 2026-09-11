import { Router } from "express";
import clerkClient from "../utils/clerk";
import { producer } from "../utils/kafka";
import { createLogger, measureAsync } from "@repo/monitoring";

const logger = createLogger("auth-service:user-route");
const router: Router = Router();

router.get("/", async (req, res) => {
  const { result: users } = await measureAsync(
    "clerk.getUserList",
    async () => {
      return await clerkClient.users.getUserList();
    },
  );
  res.status(200).json(users);
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const { result: user } = await measureAsync("clerk.getUser", async () => {
    return await clerkClient.users.getUser(id as string);
  });
  res.status(200).json(user);
});

router.post("/", async (req, res) => {
  type CreateParams = Parameters<typeof clerkClient.users.createUser>[0];
  const newUser: CreateParams = req.body;
  const { result: user } = await measureAsync("clerk.createUser", async () => {
    return await clerkClient.users.createUser(newUser);
  });

  logger.info(`User created in Clerk with ID: ${user.id}`);
  producer.send("user.created", {
    value: {
      username: user.username,
      email: user.emailAddresses[0]?.emailAddress,
    },
  });
  res.status(200).json(user);
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { result: user } = await measureAsync("clerk.deleteUser", async () => {
    return await clerkClient.users.deleteUser(id as string);
  });

  logger.info(`User deleted from Clerk with ID: ${id}`);
  res.status(200).json(user);
});

export default router;
