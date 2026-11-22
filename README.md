# 小满 · 待产倒计时

一个给妻子用的 iPhone PWA。把距离宝宝出生的日子，一天天数成温柔。

预产期固定为 **2027 年 3 月 5 日（星期五）**。首次打开会按预产期预填今天的孕周（2026-11-22 为 25 周 + 2 天），也可以按产检单修改；之后孕周跟着本机日历自动增长。

<img src="audit/screenshots/03-main.png" alt="小满主页" width="320" />

## 已实现

- 距离预产期的倒计时，预产期当天显示 0 天
- 孕周 + 孕天输入与校准；每个自然日自动递增，跨午夜自动刷新
- 40 周分段进度、孕早期 / 孕中期 / 孕晚期、下一站里程碑
- 预产期当天、超期状态和对应的温和文案
- 每日轮换的一句陪伴文案
- 设置抽屉：重新校准孕周、主屏幕安装说明、清除本机记录
- 纯静态 PWA：可添加到 iPhone 主屏幕、离线打开、无账号、无广告、无外部请求
- 12 张常见 iPhone 尺寸启动图，减少主屏冷启动白屏
- iOS 安全区适配、44px 级触控目标、读屏标签、减少动效支持
- 本地数据校验和异常兜底；按本地日历日计算，避免时区与夏令时误差

## 快速检查

```bash
cd xiaoman-pwa
npm test       # 13 项日期 / 状态单元测试
npm run check  # 42 项静态工程、manifest、图标、启动图与离线缓存检查
npm start      # 本地预览 http://127.0.0.1:4173
```

最近一次完整审计见 [audit/AUDIT.md](audit/AUDIT.md)：

- 52 / 52 项浏览器交互检查通过，0 条控制台错误
- 离线重开通过
- axe 在首次设置、主页、设置抽屉均为 0 违规（WCAG 2.2 A/AA + best-practice）
- 320px 小屏无横向溢出

## 安装到 iPhone

PWA 在 iOS 上必须通过 **HTTPS** 访问（localhost 除外），并且需要部署整个静态目录，不能只双击打开 HTML 文件。

1. 将整个项目目录部署到任意支持 HTTPS 的静态托管：Cloudflare Pages、Netlify、Vercel、GitHub Pages 或自有服务器。
2. 用 iPhone 的 **Safari** 打开部署后的网址。
3. 点击「分享」→「添加到主屏幕」→「添加」。
4. 从主屏幕打开「小满」。首次在线打开后，Service Worker 会缓存核心资源，之后可以离线使用。

> 微信内置浏览器、普通局域网 HTTP 地址和 `file://` 无法完成 iOS PWA 安装。项目全部使用相对路径，可部署在子目录。

## 日期模型

- `DUE_DATE` 只在 `assets/date.js` 定义一次，固定为 `2027-03-05`。
- 首次设置保存 `anchorDate`（今天）和 `anchorGestationalDays`（今天的孕周换成的天数）。
- 每次打开：`今天孕天 = 校准孕天 + (今天 - 校准日)`。
- 倒计时始终按固定预产期计算；修改孕周不会改变预产期。
- 系统日期被临时调早时，孕周不会倒退。
- 页面跨过午夜或从后台回到前台时自动刷新。
- 记录只保存在浏览器 `localStorage` 的 `xiaoman.profile.v1` 中，不会上传。

## 目录

```text
xiaoman-pwa/
├── index.html                  # 首次设置 + 主视图 + 设置抽屉
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # 离线缓存与版本管理
├── assets/
│   ├── app.js                  # UI、存储、无障碍与日期刷新
│   ├── date.js                 # 可独立测试的日期内核
│   └── styles.css              # 奶油底 / 柚子粉视觉系统
├── icons/
│   ├── icon.svg                # 品牌图标源文件
│   ├── *.png                   # iOS / PWA 图标
│   └── splash/                 # 12 张 iPhone 启动图
├── scripts/
│   ├── check.js                # 无依赖静态检查
│   ├── serve.js                # 本地静态服务器
│   └── generate-splash.py      # 可选的启动图生成脚本
├── tests/date.test.js          # Node 单元测试
├── audit/
│   ├── AUDIT.md                # 自我审计
│   ├── audit-results.json      # 浏览器检查原始结果
│   ├── a11y-extended.json      # 扩展无障碍结果
│   └── screenshots/            # 审计截图
└── README.md
```

## 发版

修改静态资源后，同步提升 `sw.js` 中的 `CACHE_VERSION`，避免已经安装的旧 Service Worker 继续使用旧缓存。需要重新生成启动图时：

```bash
python3 scripts/generate-splash.py
```

该脚本仅用于构建资源，依赖 Pillow 和 Linux 中文字体，不影响 PWA 运行。

内容只用于陪伴记录，不替代产检医生的建议。
