
import "./config/env.js"
import express from "express"
import router from "./routes/index.js"
import cors from "cors"
import cookieParser from "cookie-parser"
import dns from 'dns'
dns.setServers(['1.1.1.1', '8.8.8.8']);
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
const app = express()

app.use(cors({
  origin :[
  "http://localhost:5173",
  "http://localhost:5174",
  "https://kaleidoscopic-pika-c2b489.netlify.app",
  "https://curious-khapse-f12cd1.netlify.app",
  "https://saralbuy.com"
  ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"]
}))

app.use(cookieParser());
app.use(express.json({limit:'10mb'}))
app.use(express.urlencoded({extended:true}))
app.use('/api/v1',router)

app.use((err, req, res, next) => {
    const statusCode =  400;
    return res.status(statusCode).json({
        success: false,
        message:err.message || '',
        errors: err.errors || null,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
});
app.get("/health",(req,res)=>{
    res.end('ok')
})

export default app
