import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { config } from "@/config/env";
import apiRoutes from "@/routes/index";
import { notFound, errorHandler } from "@/middlewares/error.middleware";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
// The frontend proxies /api through Next (same-origin), but allow direct
// cross-origin calls with credentials too for flexibility during development.
app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  }),
);

app.get("/", (_req, res) => {
  res.json({
    name: "SWMS API",
    message: "API server is running",
    health: "/api/health",
    api: "/api",
  });
});

app.get("/api", (_req, res) => {
  res.json({
    name: "SWMS API",
    message: "API routes are available under /api",
    health: "/api/health",
  });
});

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
