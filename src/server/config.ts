function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  feishu: {
    appId: required('FEISHU_APP_ID'),
    appSecret: required('FEISHU_APP_SECRET'),
    // Optional override; by default the callback URL is derived from the incoming request
    redirectUri: process.env.FEISHU_REDIRECT_URI ?? '',
    // Optional extra user-identity scopes, space separated
    oauthScope: process.env.FEISHU_OAUTH_SCOPE ?? '',
  },
  sessionSecret: required('SESSION_SECRET'),
};
