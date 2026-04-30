import express from "express";
import { addToCart } from "../controllers/cart.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/add", auth, addToCart);


export default router;