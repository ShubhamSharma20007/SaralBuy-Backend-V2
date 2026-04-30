import ImageKit from "@imagekit/nodejs";
const client = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,  
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadFile = async (file) => {
  const result = await client.files.upload({
    file: file.buffer.toString("base64"),
    fileName: file.originalname,
    folder: "images",
  });
  return result.url;
};

export default uploadFile;
