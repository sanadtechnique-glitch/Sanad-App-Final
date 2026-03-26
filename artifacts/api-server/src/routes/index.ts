import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicesRouter);
router.use(ordersRouter);

export default router;
