import crypto from "node:crypto";
import fs from "node:fs";
import querystring from "node:querystring";
import readline from "node:readline";
import { URL } from "node:url";

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

const s2t = async (text: string) => {
  if (!text) return "";
  const res = await fetch("https://zh.wikipedia.org/w/api.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "parse",
      text,
      contentmodel: "wikitext",
      prop: "text",
      variant: "zh-tw",
      format: "json",
      formatversion: "2",
    }),
  }).then((e) => e.json());

  const html = res?.parse?.text ?? text;
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .trim();
};

const hitokoto = await fetch("https://v1.hitokoto.cn").then((res) => res.json());
const [quote, from] = await Promise.all([s2t(hitokoto.hitokoto), s2t(hitokoto.from || "")]);
const plurk = await oAuthFetch("/APP/Timeline/plurkAdd", {
  content: `${quote} [emo76]\n -- ${from}`,
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
