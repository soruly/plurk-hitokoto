import crypto from "node:crypto";
import fs from "node:fs";
import querystring from "node:querystring";
import readline from "node:readline";
import { URL } from "node:url";

process.loadEnvFile();
const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = process.env;

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.log("Please set CONSUMER_KEY and CONSUMER_SECRET in .env");
  process.exit(1);
}

const oAuthFetch = (endpoint: string, param: any) => {
  const timeStamp = Math.ceil(Date.now() / 1000).toString();
  const nonce = crypto.randomInt(1000000, 9999999).toString();
  const url = new URL(endpoint, "https://www.plurk.com");

  const searchParams = new URLSearchParams(
    Object.assign(
      {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: timeStamp,
        oauth_version: "1.0",
      },
      TOKEN && TOKEN_SECRET ? { oauth_token: TOKEN, oauth_token_secret: TOKEN_SECRET } : {},
      param,
    ),
  );
  searchParams.sort();
  searchParams.append(
    "oauth_signature",
    crypto
      .createHmac("sha1", `${CONSUMER_SECRET}&${TOKEN_SECRET || param?.oauth_token_secret || ""}`)
      .update(
        [
          "GET",
          encodeURIComponent(url.toString()),
          encodeURIComponent(searchParams.toString().replace(/\+/g, "%20")),
        ].join("&"),
      )
      .digest("base64"),
  );
  url.search = searchParams.toString().replace(/\+/g, "%20");
  return fetch(url);
};

if (TOKEN && TOKEN_SECRET) {
  console.log("TOKEN and TOKEN_SECRET are already set in .env");
  const me = await oAuthFetch("/APP/Users/me", {
    oauth_token: TOKEN,
    oauth_token_secret: TOKEN_SECRET,
  }).then((e) => e.json());
  console.log(`Authenticated as ${me.display_name}`);
  process.exit(0);
}

let { oauth_token, oauth_token_secret } = querystring.parse(
  await oAuthFetch("/OAuth/request_token", {}).then((e) => e.text()),
);

console.log(
  `Please authorize this app at https://www.plurk.com/OAuth/authorize?oauth_token=${oauth_token}`,
);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const oauth_verifier = await new Promise((resolve) =>
  rl.question("Enter verification code: ", resolve),
);
rl.close();

({ oauth_token, oauth_token_secret } = querystring.parse(
  await oAuthFetch("/OAuth/access_token", {
    oauth_token,
    oauth_token_secret,
    oauth_verifier,
  }).then((e) => e.text()),
));

console.log("Saving token in .env...");
fs.writeFileSync(
  ".env",
  [
    fs.readFileSync(".env", "utf8").trim(),
    `TOKEN=${oauth_token}`,
    `TOKEN_SECRET=${oauth_token_secret}`,
  ].join("\n") + "\n",
);

const me = await oAuthFetch("/APP/Users/me", { oauth_token, oauth_token_secret }).then((e) =>
  e.json(),
);

console.log(`Welcome ${me.display_name}`);
