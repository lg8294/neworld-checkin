/**
 * Neworld 签到脚本 - Node.js 版本
 * 功能：自动登录 neworld.cloud 并签到，发送钉钉通知
 */

const axios = require('axios');
const schedule = require('node-schedule');
const toughCookie = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const crypto = require('crypto');
require('dotenv').config();

const BASE_URL = 'https://neworld.cloud';

const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK || '';
const DINGTALK_SECRET = process.env.DINGTALK_SECRET || '';
const PROXY = process.env.HTTP_PROXY || null;

/**
 * 读取并校验配置，失败时打印错误并退出进程
 */
function loadConfigOrExit() {
  const raw = process.env.ACCOUNTS_JSON;
  const fingerprint = process.env.NEWORD_FINGERPRINT;

  if (!raw || String(raw).trim() === '') {
    console.error('[配置错误] 请设置环境变量 ACCOUNTS_JSON（JSON 数组，元素含 email、password）');
    process.exit(1);
  }

  if (!fingerprint || String(fingerprint).trim() === '') {
    console.error('[配置错误] 请设置环境变量 NEWORD_FINGERPRINT');
    process.exit(1);
  }

  let accounts;
  try {
    accounts = JSON.parse(raw);
  } catch (e) {
    console.error('[配置错误] ACCOUNTS_JSON 不是合法 JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    console.error('[配置错误] ACCOUNTS_JSON 必须是非空数组');
    process.exit(1);
  }

  for (let i = 0; i < accounts.length; i += 1) {
    const acc = accounts[i];
    if (
      !acc ||
      typeof acc.email !== 'string' ||
      acc.email.trim() === '' ||
      typeof acc.password !== 'string' ||
      acc.password === ''
    ) {
      console.error(`[配置错误] ACCOUNTS_JSON[${i}] 缺少有效的 email 或 password`);
      process.exit(1);
    }
  }

  if (DINGTALK_WEBHOOK && String(DINGTALK_SECRET).trim() === '') {
    console.error('[配置错误] 已设置 DINGTALK_WEBHOOK 时必须设置 DINGTALK_SECRET（加签密钥）');
    process.exit(1);
  }

  return {
    accounts,
    fingerprint: String(fingerprint).trim(),
  };
}

/**
 * 生成钉钉签名
 */
function getSign(timestamp) {
  const stringToSign = `${timestamp}\n${DINGTALK_SECRET}`;
  const hmac = crypto.createHmac('sha256', DINGTALK_SECRET);
  hmac.update(stringToSign);
  const sign = hmac.digest('base64');
  return encodeURIComponent(sign);
}

/**
 * 发送钉钉通知
 */
async function sendDingTalkNotification(account, msg) {
  if (!DINGTALK_WEBHOOK) {
    console.log(`[通知] ${account}: ${msg}`);
    return;
  }

  const timestamp = Date.now();
  const sign = getSign(timestamp);
  const webhookUrl = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${sign}`;

  const date = new Date().toISOString().split('T')[0];
  const markdown = {
    title: `${date} neworld 签到通知`,
    text: `### ${date} neworld 签到通知 \n\n账号：${account} \n\n> ${msg}`
  };

  try {
    const response = await axios.post(webhookUrl, {
      msgtype: 'markdown',
      markdown
    });
    console.log(`[钉钉通知] 发送结果:`, JSON.stringify(response.data));
  } catch (err) {
    console.error(`[钉钉通知] 发送失败:`, err.message);
  }
}

/**
 * 创建 axios 实例，带 cookie 支持
 */
function createClient() {
  const cookieJar = new toughCookie.CookieJar();

  const options = {
    timeout: 60000,
    jar: cookieJar,
    headers: {
      'origin': 'https://neworld.cloud',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
      'dnt': '1',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'x-requested-with': 'XMLHttpRequest',
      'accept-language': 'zh-CN,zh;q=0.9',
    }
  };

  if (PROXY) {
    const proxyUrl = new URL(PROXY);
    options.proxy = {
      host: proxyUrl.hostname,
      port: parseInt(proxyUrl.port || '8888', 10),
      protocol: proxyUrl.protocol.replace(':', '')
    };
  }

  const client = wrapper(axios.create(options));
  return client;
}

/**
 * 执行签到
 */
async function checkIn(account, password, fingerprint) {
  const s = createClient();

  console.log(`[${account}] 开始签到任务...`);

  try {
    await s.get(`${BASE_URL}/auth/login`, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });
    console.log(`[${account}] 获取登录页面成功`);

    const loginData = new URLSearchParams({
      code: '',
      email: account,
      passwd: password,
      fingerprint
    }).toString();

    const loginRes = await s.post(`${BASE_URL}/auth/login`,
      loginData,
      {
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'referer': `${BASE_URL}/auth/login`,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
      }
    );
    const loginSummary = loginRes.data && typeof loginRes.data === 'object'
      ? { ret: loginRes.data.ret, msg: loginRes.data.msg }
      : loginRes.data;
    console.log(`[${account}] 登录结果:`, JSON.stringify(loginSummary));

    if (loginRes.data.ret !== 1) {
      throw new Error(`登录失败: ${loginRes.data.msg}`);
    }

    const userRes = await s.get(`${BASE_URL}/user`, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'referer': `${BASE_URL}/auth/login`,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'sec-fetch-user': '?1',
      }
    });
    console.log(`[${account}] 用户页面获取: ${userRes.status === 200 ? '成功' : '失败'}`);

    const checkinRes = await s.post(`${BASE_URL}/user/checkin`,
      {},
      {
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'referer': `${BASE_URL}/user`,
        }
      }
    );

    console.log(`[${account}] 签到结果:`, JSON.stringify(checkinRes.data));

    const msg = checkinRes.data.msg || JSON.stringify(checkinRes.data);
    await sendDingTalkNotification(account, msg);

    return checkinRes.data;
  } catch (err) {
    console.error(`[${account}] 签到失败:`, err.message);
    if (err.response) {
      console.error(`[${account}] 响应状态:`, err.response.status);
    }
    await sendDingTalkNotification(account, `签到失败: ${err.message}`);
    throw err;
  }
}

/**
 * 主函数 - 执行所有账号签到
 * @returns {Promise<boolean>} 全部成功为 true，任一失败为 false
 */
async function main(config) {
  console.log('=== Neworld 签到开始 ===');
  console.log('时间:', new Date().toLocaleString());

  const { accounts, fingerprint } = config;
  const tasks = accounts.map((acc) => checkIn(acc.email, acc.password, fingerprint));

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((r) => r.status === 'rejected');

  if (failures.length === 0) {
    console.log('=== 所有签到完成 ===');
    return true;
  }

  console.error(`=== 签到完成，${failures.length} 个账号失败 ===`);
  return false;
}

/**
 * 定时任务调度（每天 08:00 本地时区）
 */
function scheduleDaily(config) {
  console.log('定时任务已设置: 每天 08:00 执行签到');

  schedule.scheduleJob('0 8 * * *', async () => {
    console.log('=== 定时签到触发 ===');
    const ok = await main(config);
    if (!ok) {
      process.exitCode = 1;
    }
  });
}

// 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = loadConfigOrExit();

  if (args.includes('--schedule')) {
    scheduleDaily(config);
    console.log('服务运行中，按 Ctrl+C 退出...');
  } else {
    (async () => {
      const ok = await main(config);
      process.exit(ok ? 0 : 1);
    })();
  }
}

module.exports = { checkIn, main, loadConfigOrExit };
