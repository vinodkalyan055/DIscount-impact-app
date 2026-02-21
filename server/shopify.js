const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { restResources } = require("@shopify/shopify-api/rest/admin/2024-04");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "").split(","),
  hostName: (process.env.SHOPIFY_APP_URL || "").replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  restResources,
});

// In-memory session storage (swap for DB-backed in production)
const sessionStore = new Map();

const storeSession = async (session) => {
  sessionStore.set(session.id, session);
  return true;
};

const loadSession = async (id) => {
  return sessionStore.get(id) || undefined;
};

const deleteSession = async (id) => {
  sessionStore.delete(id);
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
