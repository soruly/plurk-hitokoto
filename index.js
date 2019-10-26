require("dotenv").config();

const readline = require("readline");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const OpenCC = require("opencc");
const opencc = new OpenCC("s2t.json");
const { PlurkClient } = require("plurk2");

const { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET } = process.env;

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.log("Please set CONSUMER_KEY and CONSUMER_SECRET in .env");
  process.exit();
}

(async () => {
  if (!TOKEN || !TOKEN_SECRET) {
    const client = new PlurkClient(CONSUMER_KEY, CONSUMER_SECRET);
    const { authPage } = await client.getRequestToken();
    console.log(`Please authorize this app in ${authPage}`);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const code = await new Promise(resolve =>
      rl.question("Enter verification code: ", resolve)
    );
    rl.close();
    await client.getAccessToken(code);
    console.log("Saving token in .env...");
    fs.writeFileSync(
      ".env",
      [
        fs.readFileSync(".env", "utf8"),
        `TOKEN=${client.token}`,
        `TOKEN_SECRET=${client.tokenSecret}`
      ].join("\n")
    );
    const me = await client.request("Users/me");
    console.log(`Welcome ${me.display_name}`);
    process.exit();
  }
  const client = new PlurkClient(
    CONSUMER_KEY,
    CONSUMER_SECRET,
    TOKEN,
    TOKEN_SECRET
  );
  const hitokoto = await fetch("https://v1.hitokoto.cn").then(res =>
    res.json()
  );
  const plurk = await client.request("Timeline/plurkAdd", {
    content: opencc.convertSync(
      `${hitokoto.hitokoto} [emo76]\n -- ${hitokoto.from}`
    ),
    qualifier: ":"
  });
  await client.request("Responses/responseAdd", {
    plurk_id: plurk.plurk_id,
    content: `https://hitokoto.cn/?id=${hitokoto.id}`,
    qualifier: ":"
  });
})();
