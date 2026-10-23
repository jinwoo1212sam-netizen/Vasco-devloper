const { patternCatalog } = require("../lib/dragonx");
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  return res.status(200).json({ engine:"DRAGON-X-120", count:patternCatalog.length, patterns:patternCatalog });
};
