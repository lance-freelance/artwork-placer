import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import mediaRouter from "./media";
import placementsRouter from "./placements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(mediaRouter);
router.use(placementsRouter);

export default router;
