import fs from "node:fs";
import readline from "node:readline";
import crypto from "node:crypto";
import querystring from "node:querystring";
import { URL } from "node:url";
import OpenCC from "opencc";

process.loadEnvFile();
const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = process.env;

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.log("Please set CONSUMER_KEY and CONSUMER_SECRET in .env");
  process.exit();
}

const oAuthFetch = (endpoint: string, param: any) => {
  const timeStamp = Math.ceil(new Date().valueOf() / 1000).toString();
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

if (!TOKEN || !TOKEN_SECRET) {
  let { oauth_token, oauth_token_secret } = querystring.parse(
    await oAuthFetch("/OAuth/request_token", {}).then((e) => e.text()),
  );

  console.log(
    `Please authorize this app in https://www.plurk.com/OAuth/authorize?oauth_token=${oauth_token}`,
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
      fs.readFileSync(".env", "utf8"),
      `TOKEN=${oauth_token}`,
      `TOKEN_SECRET=${oauth_token_secret}`,
    ].join("\n"),
  );
  const me = await oAuthFetch("/APP/Users/me", { oauth_token, oauth_token_secret }).then((e) =>
    e.json(),
  );

  console.log(`Welcome ${me.display_name}`);
  process.exit();
}

const hitokoto = await fetch("https://v1.hitokoto.cn").then((res) => res.json());
const plurk = await oAuthFetch("/APP/Timeline/plurkAdd", {
  content: new OpenCC("s2t.json").convertSync(`${hitokoto.hitokoto} [emo76]\n -- ${hitokoto.from}`),
  qualifier: ":",
}).then((e) => e.json());
console.log(plurk);
console.log(
  await oAuthFetch("/APP/Responses/responseAdd", {
    plurk_id: plurk.plurk_id,
    content: `https://hitokoto.cn/?id=${hitokoto.id}`,
    qualifier: ":",
  }).then((e) => e.json()),
);
