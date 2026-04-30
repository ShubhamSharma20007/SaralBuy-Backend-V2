import { isValidObjectId } from "mongoose";
import productSchema from "../models/product.schema.js";
import { ApiResponse } from "../helpers/ApiReponse.js";
import cartSchema from "../models/cart.schema.js";

export const addToCart = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
      return ApiResponse.errorResponse(res, 400, "Invalid or missing userId");
    }

    if (!productId || !isValidObjectId(productId)) {
      return ApiResponse.errorResponse(
        res,
        400,
        "Invalid or missing productId",
      );
    }

    const product = await productSchema.findById(productId);
    if (!product) {
      return ApiResponse.errorResponse(res, 404, "Product not found");
    }

    let cart = await cartSchema.findOne({ userId });
    if (!cart) {
      cart = new cartSchema({ userId, cartItems: [] });
    }

    const alreadyExists = cart.cartItems.find((item) =>
      item.productIds.includes(productId),
    );

    if (alreadyExists) {
      return ApiResponse.successResponse(
        res,
        200,
        "Product already in your cart",
        cart,
      );
    }

    cart.cartItems.push({ productIds: [productId] });

    await cart.save();

    return ApiResponse.successResponse(res, 201, "Product added to cart", cart);
  } catch (err) {
    console.error(err);
    return ApiResponse.errorResponse(
      res,
      500,
      err.message || "Failed to add to cart",
    );
  }
};
