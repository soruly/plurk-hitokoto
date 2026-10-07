import crypto from "node:crypto";
import { URL } from "node:url";

export interface Env {
  CONSUMER_KEY: string;
  CONSUMER_SECRET: string;
  TOKEN: string;
  TOKEN_SECRET: string;
}

const s2t = async (text: string) => {
  if (!text) return "";
  const res = await fetch("https://zh.wikipedia.org/w/api.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
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
  }).then((e) => e.json() as Promise<any>);

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

const oAuthFetch = (endpoint: string, param: any, env: Env) => {
  const timeStamp = Math.ceil(Date.now() / 1000).toString();
  const nonce = crypto.randomInt(1000000, 9999999).toString();
  const url = new URL(endpoint, "https://www.plurk.com");

  const searchParams = new URLSearchParams(
    Object.assign(
      {
        oauth_consumer_key: env.CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: timeStamp,
        oauth_version: "1.0",
      },
      env.TOKEN && env.TOKEN_SECRET
        ? { oauth_token: env.TOKEN, oauth_token_secret: env.TOKEN_SECRET }
        : {},
      param,
    ),
  );
  searchParams.sort();
  searchParams.append(
    "oauth_signature",
    crypto
      .createHmac(
        "sha1",
        `${env.CONSUMER_SECRET}&${env.TOKEN_SECRET || param?.oauth_token_secret || ""}`,
      )
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

export const postHitokoto = async (env: Env) => {
  const hitokoto = await fetch("https://v1.hitokoto.cn").then((res) => res.json() as Promise<any>);
  const [quote, from] = await Promise.all([s2t(hitokoto.hitokoto), s2t(hitokoto.from || "")]);
  const plurk = await oAuthFetch(
    "/APP/Timeline/plurkAdd",
    {
      content: `${quote} [emo76]\n -- ${from}`,
      qualifier: ":",
    },
    env,
  ).then((e) => e.json() as Promise<any>);
  console.log(plurk);

  if (plurk?.plurk_id) {
    const response = await oAuthFetch(
      "/APP/Responses/responseAdd",
      {
        plurk_id: plurk.plurk_id,
        content: `https://hitokoto.cn/?id=${hitokoto.id}`,
        qualifier: ":",
      },
      env,
    ).then((e) => e.json() as Promise<any>);
    console.log(response);
  }
};

export default {
  async scheduled(_event: any, env: Env, _ctx: any) {
    await postHitokoto(env);
  },
};

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("index.ts")) {
  process.loadEnvFile?.();
  await postHitokoto(process.env as unknown as Env);
}
