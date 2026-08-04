import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// An art upload carries a base64 image, so it needs a far larger body than the
// small metadata documents every other route exchanges. It is mounted first
// and only for that path; the general parser below then sees the body as
// already read and leaves it alone.
// Image uploads arrive as base64 in JSON, so every media route needs a body
// limit far above the default ~100kb. Scoped to /api/media rather than the
// individual upload paths so adding a new kind cannot silently inherit the
// default limit and reject ordinary photographs.
app.use("/api/media", express.json({ limit: "20mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
