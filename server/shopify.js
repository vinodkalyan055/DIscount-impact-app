require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION, Session } = require("@shopify/shopify-api");
const { restResources } = require("@shopify/shopify-api/rest/admin/2024-04");
const SessionModel = require("./models/Session");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "").split(","),
  hostName: (process.env.SHOPIFY_APP_URL || "").replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  restResources,
});

// MongoDB-backed session storage
const storeSession = async (session) => {
  await SessionModel.findOneAndUpdate(
    { id: session.id },
    { id: session.id, data: session.toObject() },
    { upsert: true }
  );
  return true;
};

const loadSession = async (id) => {
  const doc = await SessionModel.findOne({ id });
  if (!doc) return undefined;
  return new Session(doc.data);
};

const deleteSession = async (id) => {
  await SessionModel.deleteOne({ id });
  return true;
};

shopify.config.sessionStorage = { storeSession, loadSession, deleteSession };

// Helper: get a GraphQL client for a shop
async function getGraphqlClient(shop) {
  const sessionId = shopify.session.getOfflineId(shop);
  const session = await loadSession(sessionId);
  if (!session) throw new Error(`No session found for ${shop}. Re-authenticate.`);
  return new shopify.clients.Graphql({ session });
}

module.exports = { shopify, storeSession, loadSession, deleteSession, getGraphqlClient };
