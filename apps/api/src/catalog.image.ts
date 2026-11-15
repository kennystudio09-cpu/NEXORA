import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
export const MAX_UPLOAD = 2 * 1024 * 1024;
export async function sanitizeImage(file: {buffer:Buffer;mimetype:string;originalname:string}|undefined) {
  if (!file || !file.buffer.length || file.buffer.length > MAX_UPLOAD) throw new BadRequestException("Image must be 1 byte–2 MiB");
  if(/[\\/\u0000]/.test(file.originalname))throw new BadRequestException("Invalid file name");
  const allowed: Record<string,string> = {"image/png":"png","image/jpeg":"jpeg","image/webp":"webp"};
  if(!allowed[file.mimetype])throw new BadRequestException("Only PNG, JPEG and WebP are supported");
  try {
    const image=sharp(file.buffer,{limitInputPixels:16000000,failOn:"warning",animated:true});
    const metadata=await image.metadata();
    if(metadata.format!==allowed[file.mimetype]||(metadata.pages??1)>1)throw new Error("Type mismatch or animation");
    const {data,info}=await image.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
    if(data.length>1024*1024)throw new Error("Encoded image too large");
    return {content:Uint8Array.from(data),mimeType:"image/webp",size:data.length,width:info.width,height:info.height};
  }catch{throw new BadRequestException("Invalid, animated, oversized or undecodable image");}
}
