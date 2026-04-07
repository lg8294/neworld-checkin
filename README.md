# Neworld Check-in (Node.js 版本)

## 免责声明

- 本仓库及代码**仅供个人学习、研究与技术交流**。
- **非** Neworld 官方项目；与平台无关联，不保证可用性、不承担任何后果。
- 使用者须自行遵守目标平台服务条款与适用法律法规；**因使用本项目产生的风险与责任由使用者自行承担**。

## 当前状态

- Neworld 签到/登录已要求**验证码**（人机验证），本仓库基于账号密码、`NEWORD_FINGERPRINT`、无人工介入的自动化方式**已无法可靠完成签到**。
- 本地脚本与 **GitHub Actions** 定时任务在现状下**很可能持续失败**；workflow 仍保留，仅作历史与结构参考。

下文「安装」「配置」「GitHub Actions」等描述的是**原设计**；在平台侧流程变更后文档仅供查阅，**勿预期开箱即用**。原脚本用于自动签到并发钉钉通知，凭证仅通过环境变量配置，**勿将真实凭证写入代码或提交到 Git**。

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

请先阅读 [当前状态](#当前状态)；在需验证码的前提下，下列命令多数情况下无法完成有效签到。

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
