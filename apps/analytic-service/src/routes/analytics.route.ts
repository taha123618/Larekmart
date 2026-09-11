import { Router, Request, Response } from "express";
import {
  getMetricsSnapshot,
  getDailyAnalytics,
  getRecentEvents,
} from "../services/metrics.service.js";
import { shouldBeAdmin } from "../middleware/authMiddleware.js";

const router: Router = Router();

// Get real-time summary KPIs
router.get("/summary", shouldBeAdmin, async (req: Request, res: Response) => {
  try {
    const summary = getMetricsSnapshot();
    return res.status(200).json(summary);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to retrieve summary metrics" });
  }
});

// Get historical daily aggregations for charts
router.get(
  "/daily-chart",
  shouldBeAdmin,
  async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const dailyData = await getDailyAnalytics(isNaN(days) ? 30 : days);
      return res.status(200).json(dailyData);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to retrieve daily chart analytics" });
    }
  },
);

// Get recent audit event stream
router.get("/events", shouldBeAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const events = await getRecentEvents(isNaN(limit) ? 20 : limit);
    return res.status(200).json(events);
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve audit events" });
  }
});

export default router;
