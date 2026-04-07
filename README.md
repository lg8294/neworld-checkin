# Neworld Check-in (Node.js 版本)

自动签到 Neworld 账号，发送钉钉通知。账号、指纹、钉钉密钥均通过环境变量配置，**勿将真实凭证写入代码或提交到 Git**。

## 安装

```bash
cd neworld-checkin
npm install
```

## 配置

1. 复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

2. 编辑 `.env`，填写以下变量：

| 变量                 | 必填                  | 说明                                                                     |
| -------------------- | --------------------- | ------------------------------------------------------------------------ |
| `ACCOUNTS_JSON`      | 是                    | JSON 数组字符串，每项为 `{"email":"...","password":"..."}`，建议整段单行 |
| `NEWORD_FINGERPRINT` | 是                    | 登录接口所需的 `fingerprint`                                             |
| `DINGTALK_WEBHOOK`   | 否                    | 钉钉机器人 Webhook；不填则通知只打印到控制台                             |
| `DINGTALK_SECRET`    | 与 Webhook 同用时必填 | 加签密钥                                                                 |
| `HTTP_PROXY`         | 否                    | 代理地址，如 `http://127.0.0.1:8888`                                     |

示例（请替换为你的真实值，**不要提交 `.env`**）：

```env
ACCOUNTS_JSON=[{"email":"you@example.com","password":"your-password"}]
NEWORD_FINGERPRINT=your-fingerprint-string
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=your-sign-secret
```

若已设置 `DINGTALK_WEBHOOK` 但未设置 `DINGTALK_SECRET`，脚本会报错退出。

## 使用

### 立即执行签到

```bash
npm start
# 或
node index.js
```

### 定时执行（本地，每天 8:00）

```bash
node index.js --schedule
```

## GitHub Actions

仓库已包含 **北京时间每天 20:00** 的定时任务（workflow 内 cron 为 UTC `0 12 * * *`）。

在 GitHub **Settings → Secrets and variables → Actions** 中，对同名键可同时使用 **Secrets** 和/或 **Variables**（Repository variables）。工作流会按 `Secret` 优先：若某键在 Secrets 中有值则用 Secrets，否则回退到 Variables。

- `ACCOUNTS_JSON`
- `NEWORD_FINGERPRINT`
- `DINGTALK_WEBHOOK`、`DINGTALK_SECRET`（使用钉钉时）
- 可选：`HTTP_PROXY`

**安全建议**：密码、指纹、钉钉 Webhook 与加签密钥等敏感内容请放在 **Secrets**；非敏感项（例如 `HTTP_PROXY`）可视情况使用 **Variables**。

推送后可在 **Actions** 中通过 **Run workflow** 手动试跑。
