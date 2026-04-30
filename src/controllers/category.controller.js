import { isValidObjectId } from "mongoose";
import { ApiResponse } from "../helpers/ApiReponse.js";
import categorySchema from "../models/category.schema.js";

export const GetCategories = async (req, res) => {
  try {
    const categories = await categorySchema.find().lean();
    return ApiResponse.successResponse(
      res,
      200,
      "categories fetched successfully",
      categories,
    );
  } catch (error) {
    return ApiResponse.errorResponse(res, 400, error?.response || error, null);
  }
};

export const GetCategoriesById = async(req,res)=>{
    const {categoryId}  = req.params;
    try {
        if(!isValidObjectId(categoryId)) return ApiResponse.errorResponse(res, 400, "Invalid category ID");
        const category = await categorySchema.findById(categoryId).lean();
        if (!category) return ApiResponse.errorResponse(res, 404, "Category not found");
        return ApiResponse.successResponse(res, 200, "Category fetched successfully", category);
    }
    catch(err){
        console.log(err)
        return ApiResponse.errorResponse(res, 400, err.message);
    }
}
