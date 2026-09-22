import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { config } from "@/config/env";
import apiRoutes from "@/routes/index";
import { notFound, errorHandler } from "@/middlewares/error.middleware";

const app = express();

// `trust proxy` deliberately left at Express's default (false/off) rather
// than changed here. The login/forgot-password rate limiters below key on
// req.ip; behind a single reverse proxy (typical for most PaaS deploys),
// Express would otherwise see the proxy's IP for every request and the
// limiters would treat all users as one caller. But blindly trusting
// X-Forwarded-For is itself a spoofing risk if the app is ever reachable
// directly (not behind a trusted proxy) — a malicious client could set that
// header to bypass rate limiting entirely. This depends on the actual
// deployment topology, which isn't known at the time of this change: if you
// deploy behind exactly one trusted reverse proxy, set
// `app.set("trust proxy", 1)` to match that specific hop count.
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
