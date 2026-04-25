console.log('AUTH_EMAIL:', process.env.AUTH_EMAIL);
console.log('AUTH_HASH:', (process.env.AUTH_HASH ?? '').slice(0,15));
console.log('SESSION_SECRET len:', (process.env.SESSION_SECRET ?? '').length);
