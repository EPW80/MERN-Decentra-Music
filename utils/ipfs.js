import { create } from "ipfs-http-client";

const ipfs = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: `Basic ${Buffer.from(
      `${process.env.INFURA_PROJECT_ID}:${process.env.INFURA_PROJECT_SECRET}`
    ).toString("base64")}`,
  },
});

export async function uploadToIPFS(buffer) {
  try {
    const result = await ipfs.add(buffer);
    return result.path;
  } catch (error) {
    throw new Error("IPFS upload failed");
  }
}

export function getIPFSUrl(hash) {
  return `https://ipfs.infura.io/ipfs/${hash}`;
}
