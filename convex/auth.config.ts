// Custom JWT auth for browser->Convex (reactivity). The Next server (iron-session)
// mints a short-lived RS256 JWT for the logged-in user; Convex validates it here
// against the inline public JWKS. Login/bcrypt/TOTP stay in iron-session unchanged.
// Private signing key lives in data/auth.json (convexJwtPrivateKey), never here.
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "vitals",
      issuer: "https://vitals.club",
      jwks: "data:text/plain;charset=utf-8;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJuIjoibVNZQTRRRUNoWXlQQzhPeUJzZU5JYmtlV29ZVV9LdGw5Z1VDekUzZUw2YnBBVUhBMkpHd0E0cVM4RmYxbXVwMWwtUHlNNkhMNnFPZG5rdjRqNVZHTTZxeUtvQUlUdUE2c2VWUG9OcV92ZnE1NE93T2N4cjBCT0tXV1BXMkxJSk5OVnl4OE9SaFh6LUlqdnl5MndGMEtmbmtIdVpScWFuZGg2NFgtSE1MQzBsQUpRM004ejRoTzlBZ3BfcjgxT1Z0TUhBa29Ddzhod3RtVE43dS00bk0xaFRLSVFtTlFtaHhJeURfeEUyREpmMW5KUkY2TXlZc1VVUGcyaDFSZDZlaUlFSUU1TkVqQzhvek1tMERYQXJWbmpiYUtScEpxQllmWHNtdW5ucEhabU44VkxGaU5WZXNHUmhDbFJrRVRTWmFjWHd2bzRrMG0xYkVraC1sNFBwS3NRIiwiZSI6IkFRQUIiLCJ1c2UiOiJzaWciLCJhbGciOiJSUzI1NiIsImtpZCI6InZpdGFscy0xIn1dfQ==",
      algorithm: "RS256",
    },
  ],
};
