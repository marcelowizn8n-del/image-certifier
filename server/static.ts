import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Prevent stale HTML from being cached (can cause blank screen after new deploys
        // when cached index.html references old hashed asset filenames).
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader("Cache-Control", "no-store, max-age=0");
          return;
        }

        if (
          filePath.endsWith(`${path.sep}sw.js`) ||
          filePath.endsWith(`${path.sep}manifest.json`)
        ) {
          res.setHeader("Cache-Control", "no-store, max-age=0");
          return;
        }

        // Cache versioned build assets aggressively.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();

    const accept = String(req.headers.accept || "");
    if (!accept.includes("text/html")) return next();

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
