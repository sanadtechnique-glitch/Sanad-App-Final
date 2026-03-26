import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import articlesRouter from "./articles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicesRouter);
router.use(ordersRouter);
router.use(categoriesRouter);
router.use(suppliersRouter);
router.use(articlesRouter);

export default router;
