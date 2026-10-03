import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "@/config/env";
import apiRoutes from "@/routes/index";
import { notFound, errorHandler } from "@/middlewares/error.middleware";

const app = express();

// Sensible default security headers. CSP is left at Helmet's default (not
// customized or disabled) — it's inert either way, since every response here
// is JSON, never HTML a browser would render/execute. HSTS is the one
// setting explicitly gated on production: browsers already ignore it over
// plain HTTP by spec, but this makes that intent explicit rather than
// relying on that nuance, matching how cookieSecure/frontendOrigin below are
// already conditioned on config.isProduction.
app.use(helmet({ hsts: config.isProduction }));

// Render (this app's production host) puts exactly one reverse proxy
// between the internet and this process, so trusting one hop's
// X-Forwarded-For is safe here and is what makes the login/forgot-password
// rate limiters (which key on req.ip) see each real caller's IP instead of
// Render's proxy IP for every request. Gated on production only — in local
// dev there's no proxy in front of this process, and blindly trusting
// X-Forwarded-For when reachable directly would let a client spoof its own
// IP to bypass rate limiting.
if (config.isProduction) {
  app.set("trust proxy", 1);
}

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
