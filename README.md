# plurk-hitokoto

[![License](https://img.shields.io/github/license/soruly/plurk-hitokoto.svg?style=flat-square)](https://github.com/soruly/plurk-hitokoto/blob/master/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/soruly/plurk-hitokoto/node.js.yml?style=flat-square)](https://github.com/soruly/plurk-hitokoto/actions)

Post quotes from [hitokoto (一言)](https://hitokoto.cn) to plurk (噗浪)

## Usage

1. Checkout this repository
2. `npm install`
3. Create an application in https://www.plurk.com/PlurkApp/ and obtain App key and App secret
4. Copy .env.example to .env, enter the App key and App secret you have just obtained
5. `node index.ts`
6. Open the authorization url as prompted and enter the 6 digit code
7. `node index.ts` again

You can setup a cron job to schedule posts

## Caveat

This uses OpenCC to convert Simplified Chinese to Traditional Chinese, which requires `g++`
