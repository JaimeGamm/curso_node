import { Router } from "express";

import { MovieContoller } from "../controllers/movies.js";

export const moviesRouter = Router();

moviesRouter.get("/", MovieContoller.getAll);

moviesRouter.get("/:id", MovieContoller.getById);

moviesRouter.post("/", MovieContoller.create);

moviesRouter.delete("/:id", MovieContoller.delete);

moviesRouter.patch("/:id", MovieContoller.update);
