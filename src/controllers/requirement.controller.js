import { ApiResponse } from "../helpers/ApiReponse.js";
import requirementSchema from "../models/requirement.schema.js";

export const getRecentRequirements = async(req,res)=>{
  try {

    let requirements = await requirementSchema.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productId"
        }
      },
      {$unwind:'$productId'},
      {
        $lookup:{
          from:"categories",
          let:{categoryId:"$productId.categoryId"},
          pipeline:[
            {
              $match:{
                $expr:{
                  $eq:["$_id","$$categoryId"]
                }
              }
            }
          ],
          as:"productId.categoryId"
        }
      },
      {$unwind:"$productId.categoryId"},
      {
        $lookup: {
          from: "users",
          localField: "buyerId",
          foreignField: "_id",
          as: "buyerId"
        }
      },
      {$unwind:'$buyerId'},
      {$sort:{createdAt:-1}},
      {$limit:3},
    ])

    return ApiResponse.successResponse(res, 200, "Requirements fetched successfully", requirements);
  } catch (error) {
    console.log(error)
    return ApiResponse.errorResponse(res, 400, "Something went wrong while getting requirements");
    
  }
}