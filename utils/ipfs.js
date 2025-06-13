const { create } = require("ipfs-http-client");

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

exports.uploadToIPFS = async (buffer) => {
  try {
    const result = await ipfs.add(buffer);
    return result.path;
  } catch (error) {
    throw new Error("IPFS upload failed");
  }
};

exports.getIPFSUrl = (hash) => {
  return `https://ipfs.infura.io/ipfs/${hash}`;
};
