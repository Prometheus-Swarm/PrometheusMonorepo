import { Router } from "express";
import { fetchStar } from "../controllers/star/fetchStar";
const router = Router();

router.post(
  "/fetch-star",
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=30");
    next();
  },
  fetchStar,
);

export default router;
