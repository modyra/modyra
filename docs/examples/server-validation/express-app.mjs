// Express route — same schema, same serverValidate call.
import express from "express";
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema.mjs";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/signup", (req, res) => {
    const errors = serverValidate(signupSchema, req.body);
    if (errors.length > 0) {
      res.status(422).json({ errors });
      return;
    }
    res.json({ ok: true });
  });
  return app;
}
