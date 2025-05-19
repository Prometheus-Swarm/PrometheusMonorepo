import { Router } from "express";
import { info as infoV2 } from "../controllers/prometheus/v2/info";
import { verifyBearerToken } from "../middleware/auth";
import { info as infoV3 } from "../controllers/prometheus/v3/info";
const router = Router();

router.get(
  "/v2/info",
  verifyBearerToken,
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=30");
    next();
  },
  infoV2,
);

router.get(
  "/v3/info",
  // verifyBearerToken,
  infoV3,
);

export default router;
