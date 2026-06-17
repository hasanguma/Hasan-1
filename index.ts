import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import bookingsRouter from "./bookings";
import galleryRouter from "./gallery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(servicesRouter);
router.use(bookingsRouter);
router.use(galleryRouter);

export default router;
