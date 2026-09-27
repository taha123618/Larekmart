import { Router } from "express";
import clerkClient from "../utils/clerk.js";
import { producer } from "../utils/kafka.js";
import { createLogger, measureAsync } from "@repo/monitoring";
import { UserFormSchema } from "@repo/types";
import { shouldBeAdmin } from "../middleware/authMiddleware.js";

const logger = createLogger("auth-service:user-route");
const router: Router = Router();

// Apply defense-in-depth admin authorization
router.use(shouldBeAdmin);

router.get("/", async (req, res) => {
  try {
    const { result: users } = await measureAsync(
      "clerk.getUserList",
      async () => {
        return await clerkClient.users.getUserList();
      },
    );
    return res.status(200).json(users);
  } catch (error) {
    logger.error("Failed to list users", error);
    return res.status(500).json({ message: "Failed to list users" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const { result: user } = await measureAsync("clerk.getUser", async () => {
      return await clerkClient.users.getUser(id.trim());
    });
    return res.status(200).json(user);
  } catch (error) {
    logger.error(`Failed to get user ${id}`, error);
    return res.status(404).json({ message: "User not found" });
  }
});

router.post("/", async (req, res) => {
  const parsed = UserFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid user data",
      issues: parsed.error.issues,
    });
  }

  try {
    const { result: user } = await measureAsync(
      "clerk.createUser",
      async () => {
        return await clerkClient.users.createUser({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          username: parsed.data.username,
          emailAddress: parsed.data.emailAddress,
          password: parsed.data.password,
        });
      },
    );

    logger.info(`User created in Clerk with ID: ${user.id}`);
    producer.send("user.created", {
      value: {
        userId: user.id,
        username: user.username,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
    return res.status(201).json(user);
  } catch (error) {
    logger.error("Failed to create user in Clerk", error);
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Failed to create user",
    });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const { result: user } = await measureAsync(
      "clerk.deleteUser",
      async () => {
        return await clerkClient.users.deleteUser(id.trim());
      },
    );

    logger.info(`User deleted from Clerk with ID: ${id}`);
    producer.send("user.deleted", {
      value: {
        userId: id.trim(),
      },
    });
    return res.status(200).json(user);
  } catch (error) {
    logger.error(`Failed to delete user ${id}`, error);
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Failed to delete user",
    });
  }
});

export default router;
