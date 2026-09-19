import mongoose from "mongoose";

let isConnected = false;

export const connectCartDB = async (mongoUrl?: string) => {
  if (isConnected && mongoose.connection.readyState === 1) return;

  const url = mongoUrl || process.env.MONGO_URL;
  if (!url) {
    throw new Error("MONGO_URL is not defined in env file!");
  }

  try {
    await mongoose.connect(url);
    isConnected = true;
    console.log("Connected to Cart MongoDB database successfully");
  } catch (error) {
    console.error("Cart MongoDB connection failed:", error);
    throw error;
  }
};

export const closeCartDB = async () => {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
};

export const isCartDbConnected = () => {
  return mongoose.connection.readyState === 1;
};
