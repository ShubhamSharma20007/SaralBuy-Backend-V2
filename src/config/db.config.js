import mongoose from "mongoose";

let connection = null;
export default function mongoCtx(){
   if(connection){
       return connection
   } 
   connection =  mongoose.connect(process.env.DB_CTX,{
        dbName:'saralbuy'
    })
    .then(() => {
        console.log("Connected DB:", mongoose.connection.name);
        console.log("Mongo Host:", mongoose.connection.host);
        console.log("Connected to MongoDB 🚀");
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB", error);
        process.exit(1);
    });
}