import Router from "@koa/router";
import { ShippingController } from "../controllers/shipping.controller.js";

export const shippingRouter = new Router({ prefix: "/api/v1/shipping" });

shippingRouter.get("/rates", ShippingController.getRates);
shippingRouter.get("/methods", ShippingController.getMethods);
