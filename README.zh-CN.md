# 图片

[English](README.md) | 简体中文

**要一张图，就给你一张图。**

给对话模型一个 `generate_image` 工具，用你供应商提供的生图模型出图。说一句"给发布会画张海报"，
图就出现在对话里、就在它生成的位置。画过的所有图都收在一个「图片」面板里：瀑布流浏览、放大、下载。
面板的「玩法」页收着试过效果的提示词模板：40 个内置的、你自己的、社区的，一键套用；每个玩法都能变成一段文字、
一张图，或者投稿到社区。

```
> 画一张海报：深蓝夜空下的灯塔，极简扁平风，标题写 "Night Shift"
  ▸ Completed in 24s
  [ 海报 ]
  海报画好了：深蓝夜空下的灯塔，扁平风格，标题 "Night Shift"。
```

## 安装

在 DeepSeek Harness 里加入 [DSH Plugins](https://github.com/kadaliao/dsh-plugins) 的索引（**Plugins → Discover → Sources**）：

```
https://raw.githubusercontent.com/kadaliao/dsh-plugins/main/marketplace.json
```

然后安装 **Images**。Discover 标签属于实验性的 **Custom plugin markets** 功能；看不到的话先在
**Plugins → Experimental plugins** 里打开。

不用 Discover 的话，把包名贴进插件管理器：

```
@kadaliao/dsh-images
```

也可以在终端里用 `dsh` 命令行装（桌面版用 `--profile desktop`，装完重启 Harness）：

```
dsh plugin --profile web add @kadaliao/dsh-images
```

想用还没发布的最新代码，改用 Git spec `git+https://github.com/kadaliao/dsh-images.git#main`。

装好后打开左侧栏的**图片**，点**设置**，填上生图模型（见[设置](#设置)）。安装后刷新一次页面。

## 更新

每次打开图片面板，插件会检查一次自己有没有新版本；一分钟内再打开用上次的结果，后台不定时检查。检查走 Harness 自己的插件管理，和「插件」页「版本」一栏是同一个检查，只向 npm 查询这一个包。有新版本时，面板顶部会出现一条提示：点「更新」由 Harness 安装新版本，装之前先确认它和你的 Harness 兼容，装失败会把原来的版本装回去。更新时面板会先关闭，装好后自动重新打开。「稍后」一天内不再提醒，「跳过此版本」到下一个版本出来前不再提醒。从本地文件夹或 Git 装的不检查。

## 在对话里

你要图时，模型会带着一段写得很细的提示词调用 `generate_image`。供应商出图期间，回合的过程折叠里
有一块闪动的占位图，下面是提示词。图回来后，它作为对话里独立的一行显示在模型回复上方，折叠收起
后依然可见。一次要几张（`n` 最多 4）就并排放。

鼠标移到图上出现控件：**下载**，以及 **⋯ 菜单**（下载、复制提示词）。点图放大。查看器里滚轮（或触控板双指捏合）以鼠标位置为中心缩放，
范围 50%–1000%；顶栏的 `−` / `+` 按钮逐级缩放，点中间的百分比回到适应屏幕。放大后可拖动平移，双击在 1× 和 2× 之间切换。
快捷键：`+` `-` 缩放，`0` 适应屏幕，`←` `→` 在这次调用的几张图之间切换，`Esc` 关闭。

图下面有一行小字：哪个模型画的、像素尺寸、花了多少钱（`gpt-image-1.5 · 1024×1024 · ≈ $0.017`）。
模型自己也会收到这张图（在支持图片输入的模型上），所以它能检查自己画得对不对，并描述画了什么。

## 参考图输入

`generate_image` 也能吃图。贴一张照片或截图、指一个文件、或者引用它之前画过的图，再说要怎么改——
「给这张照片里的猫戴顶派对帽」「把这两个角色放进同一张海报」「这个角色在跑步，做成 GIF」。模型会把它们
放进 `images`（最多 16 张），每一项可以是：

- 对话里图片旁边显示的附件 ID（`sha256:…`）；
- 这个工具之前生成的图片 ID（每次结果里都会写出 ID）；
- 文件路径：绝对路径、`~/…`，或相对于会话工作目录的路径。

带参考图时请求发到供应商的 `POST /images/edits`（multipart，模型和其他参数不变），而不是
`/images/generations`。输入支持 PNG、JPEG、WebP；之前生成的 GIF 会以它的精灵图发出去，所以动图也能接着改。
工具卡片上会显示「基于 N 张参考图」。供应商和生图模型需要支持 edits（OpenAI 的 `gpt-image-*` 支持，
多数网关会透传）。

## 动图（GIF）

要 GIF、动图、表情包（"做一张阿比西尼亚猫追毛线球的 GIF"）时，模型调用 `generate_image` 时会带上
`frames`（4、6、9 或 16 帧），可选 `frameMs`（每帧时长，默认 100 毫秒）。生图模型只会画静态图，
所以插件让它画一张**精灵图**——同一场景、同一段循环动作的若干帧排成网格——再自己切帧、编码成
无限循环的 GIF（每帧最长边 480 px，全片共用调色板，用有序抖动避免颜色闪烁）。只发一次生图请求，
费用和一张静态图一样。

对话里和面板里显示的、下载得到的都是 GIF（`… · GIF · 16 帧 · …`）。Harness 的附件只存单帧图，
所以交给模型看的是那张精灵图；精灵图也存在 GIF 旁边（`<id>-sheet.png`），删 GIF 时一起删。
动作是否顺滑取决于模型帧间画得是否一致：奔跑、挥手、弹跳、旋转这类简单重复的动作效果最好。

目前确认 OpenAI 的 **gpt-image** 系列（`gpt-image-1.5`、`gpt-image-2`、`gpt-image-2.5-*`、`gpt-image-2.6-*` 等，带不带网关前缀都行）
能画出对得齐的精灵图。换成非 GPT 系列的模型
仍会生成 GIF，但结果下方和设置抽屉里都会提示「该模型不一定支持 GIF 素材生成」：不按网格出图的模型，做出来的 GIF
只是同一张图的不同局部来回闪。以后确认了其他模型可用，再加进来。

## 「图片」面板

左侧栏的 **Images**（或输入 `/images`）打开图库：所有会话里生成过的图，最新的在前，瀑布流卡片。
每张卡片显示提示词、模型、像素尺寸、费用和生成时间；标题栏累计已花的钱。悬停出现**下载**和 **⋯ 菜单**（下载、复制提示词、
做同款、存为玩法、下载（附带配方）、从图库移除）；点击放大，方向键在整个图库里翻页。查看器顶栏的**打开所属会话**跳到画这张图的会话（悬停可看会话标题）；
会话已归档时不会直接跳转，查看器会提示，并给出**取消归档并打开**（子代理画的图，取消归档的是它所在的上级会话）；会话已删除时提示它已不存在。面板打开时会自动刷新，往下滚动加载更早的。

从图库移除只删插件自己存的那份；它所在的会话里仍然能看到这张图（走 Harness 的附件存储）。

## 玩法

一个玩法（配方）就是一段试过效果的提示词模板：带几个空，定好尺寸或动图参数，注明出处。面板的「玩法」页把它们
排成带封面的卡片，可以搜索，按类别（照片变身、手绘、杂志海报、信息图、3D、贴纸动图、插画、产品、漫画）和来源
（内置、我的、社区）筛选。

点开一个，能看到封面、它需要什么、从哪来。填好空（每个空都显示默认值），再写点别的要求，点**用它开始创作**：
会在插件自己的**图片**工作区（而不是你正在用的那个）新开一个对话，输入框里是一条写明玩法的消息。这个工作区的文件夹是
`~/.dsh/images/workspace`，第一次用时自动创建并加到侧栏；`workdir` 可以换一个。需要你的图的玩法（把照片做成手办、给线稿上色）会提示你，发送前
在输入框里附上即可。模型带着玩法的 ref 和填好的空调用 `generate_image`，由工具自己套模板，所以试过的原文原样
交给生图模型，你额外的要求接在后面。画出来的图在对话和图库里都标着用的玩法，点标签就能打开它。

模型也会自己找玩法：问一句"有什么杂志封面的玩法？"或者"把这个画成黑板课堂"，它会用 `image_recipes` 工具去搜。

**内置玩法。** 40 个，改编自 GitHub 上 star 最多、许可允许转载的提示词合集——
[JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills)（MIT）、
[PicoTrex/Awesome-Nano-Banana-images](https://github.com/PicoTrex/Awesome-Nano-Banana-images)（Apache-2.0）、
[YouMind-OpenLab/awesome-gpt-image-2](https://github.com/YouMind-OpenLab/awesome-gpt-image-2) 和
[awesome-nano-banana-pro-prompts](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts)（CC BY 4.0）、
[ZeroLu/awesome-nanobanana-pro](https://github.com/ZeroLu/awesome-nanobanana-pro)（MIT）——做成了模板，品牌和
工作室的名字换成了对风格本身的描述。每个都注明来源和原作者，完整清单见 [recipes/CREDITS.md](recipes/CREDITS.md)。
封面都是用 gpt-image-2.6 按内置的配方实际画出来的。

**我的玩法。** 图库里图片的 **⋯ 菜单**有：

- **做同款**：把这张图自己的提示词和设置当作玩法，写上想改什么，开新对话。
- **存为玩法**：把这张图的提示词和设置存到「我的」，图片当封面。在那里可以编辑：把某个词改写成 `{{名字}}` 就成了
  一个空，再给它一个默认值。也可以直接让模型"把这张图做成一个玩法"，它会自己设计空（`image_recipes` 的 `save`）。
- **下载（附带配方）**：PNG 里带着它的配方（见下文）。

内置和社区玩法可以用**存到我的**复制一份。自己的玩法没有封面时，第一张用它画的图自动成为封面。

## 分享玩法

每个玩法都有三种分享方式，都不需要服务器：

- **复制配方串**：一小段文字，标题加一行 `dshimg1.…`（压缩后的配方）。聊天软件会压缩图片，文字不受影响。
  在「玩法 → 导入」里粘贴，或者直接粘贴到对话里（模型会帮你导入）。
- **分享卡**：一张 PNG，有封面、标题和简介，配方藏在图片的文本块里。把它拖到「玩法」页（或在「导入」里选择）就能
  导入。**下载（附带配方）**对任何一张图都做同样的事。会抹掉图片元数据的软件只保留图片、丢掉配方，这时连同配方串一起发。
- **分享到社区**：只限你自己的玩法。面板先完整展示将要公开的内容（标题、简介、提示词、参数；你的照片和对话一律
  不会上传），再在 [kadaliao/dsh-images-recipes](https://github.com/kadaliao/dsh-images-recipes) 打开一个已填好的
  issue。把一张图拖进「封面」栏提交；工作流检查后开 PR，合并后所有人都能看到。

**社区。** 「玩法」页默认订阅社区索引（`https://raw.githubusercontent.com/kadaliao/dsh-images-recipes/main/index.json`，
GitHub 连不上时走 jsDelivr 镜像）：第一次打开时拉取，之后每周一次，缓存在 `~/.dsh/cache/images/recipes/`。封面只下载
一次并缓存。每个社区玩法的 issue 就是它的主页：在那里点 👍 就是投票，评论里的图就是作品墙，索引每天统计一次；社区玩法
按投票数排序。用社区玩法画的图，菜单里有**晒到作品墙**：复制图片并打开那个页面。

**订阅源。** 「玩法 → 订阅源」列出你订阅的索引：可以移除社区源、刷新，或者添加任何通过 HTTPS 提供同格式索引的地址——
团队或朋友圈都可以自己办一个（格式见社区仓库的说明）。

拉取索引和封面时不会发送任何关于你的信息。社区玩法是别人写的文字：它和所有玩法一样要通过格式检查，合并前经过人工审核，
模型也会被告知只能把它当作生图提示词使用，不能当作对自己的指令。

## 设置

「图片」面板右上角的**设置**打开一个抽屉，插件需要的都在里面；保存到
`~/.dsh/cache/images/settings.json`，下一张图就生效，不用重载。

- **连接** —— 走哪条供应商线路：*跟随会话*（聊天模型用的那个）、Harness 里配置过的任一供应商、或
  *自定义地址*。接口地址都可以另填。**API 密钥**只给这个插件用，存在本机的 Harness 凭据库里
  （`DSH_IMAGES_API_KEY`），不会再显示，优先于供应商自己的密钥；留空就继续用供应商的。
  **测试连接并拉取模型**会请求供应商的 `/models`，把其中的生图模型列出来供选。
- **模型** —— 按供应商叫法填的模型 id、默认尺寸、质量档。模型框输入即搜：用过的模型、供应商列出
  的模型（**测试连接**之后）、[LiteLLM 价目表](#费用)里的生图模型。字母可以跳着打（`img26` 能找到
  `gpt-image-2.6-sunburst`），价目表里的名字会自动带上框里已有的路由前缀（`sub2api/`），或你输入的
  前缀。列表里没有的 id 照样可以直接填。模型框下面会说明这个模型按什么计价。
- **计费** —— 每张单价和币种，只在模型既不返回用量、也不在任何价目表里时用。下面是 LiteLLM 价目表
  的状态（带**更新**按钮），以及已生成的张数和费用，按模型分列。

同样的值也可以写在 profile patch（`cordis.patch.yml`）里插件那一行；抽屉里的优先，抽屉里清空某项
就回落到 patch 的值。

| 键 | 默认 | 作用 |
| --- | --- | --- |
| `model` | — | 要用的生图模型，按供应商的叫法：`gpt-image-1.5`、`gpt-image-1`、`doubao-seedream-4-0-250828`…… |
| `provider` | 会话用的那个 | 用哪个供应商（`llm-pi-ai` 里的 provider 名）的 `baseURL` 和 key；填 `custom` 表示只用 `baseURL`。 |
| `baseURL` / `apiKeyEnv` | 取自供应商 | 请求地址和签名用的凭据名，给 Harness 里没配置的供应商用。 |
| `size` | `1024x1024` | 模型没另外指定时的尺寸（`1536x1024`、`1024x1536`、`auto`）。 |
| `quality` | 模型默认 | 支持质量档的模型用（`low`、`medium`、`high`）。 |
| `pricePerImage` / `currency` | — / `USD` | 插件算不出价格的模型，按这个单价计。 |
| `priceCatalog` | LiteLLM | 兜底价目表：`false` 表示不用，或填另一个 LiteLLM 格式文件的 URL。 |
| `enabled` | `true` | `false` 保留图库但不给模型提供工具；运行时用 `/images on`、`/images off` 切换。 |
| `timeoutMs` | `180000` | 一次请求最多等多久。 |
| `workdir` | `~/.dsh/images/workspace` | 图片工作区的文件夹，玩法新开的对话都在这里。 |

```yaml
- id: images
  config:
    model: gpt-image-1.5
    # provider: openai
    # size: 1536x1024
```

请求是 OpenAI 兼容的 `POST <baseURL>/images/generations`，带 `model`、`prompt`、`size`、`n`，
所以凡是提供这个接口的供应商或网关都能用，包括把多家厂商挂在一个地址后面的本地网关。返回里图片
内联（`b64_json`）或给 URL 都行。

## 费用

每次调用是向生图模型发一次请求，按供应商的生图计费。除此之外插件只会发一种请求：下面说的价目表下载。图也会放进对话给模型看，这部分
按聊天模型的图片输入 token 计；纯文本模型收到的是一行占位说明。

每张图都带一个费用估算，按下面的顺序取第一个能用的：

1. **供应商返回的用量。** OpenAI 的生图模型会返回 `usage`（输入、输出 token），插件按官方 token
   单价计算（gpt-image-1.5：文本输入 $5/M、图片输出 $32/M；gpt-image-1：$5/M 和 $40/M；
   gpt-image-1-mini：$2/M 和 $8/M）。更新的模型从 LiteLLM 价目表取 token 单价
   （gpt-image-2.6-sunburst：$5/M 和 $30/M）。这是精确值。
2. **供应商报价**：`/models` 列表里带的每张单价（OpenRouter 风格的 `pricing.image`），测试连接时
   学到。
3. **内置价目表**：按质量和形状的每张固定价（gpt-image-1.5、gpt-image-1、gpt-image-1-mini、
   DALL·E 3 和 2、豆包 Seedream），核对日期显示在设置抽屉里。
4. **LiteLLM 价目表**的每张单价，给上面都不认识的模型用（Grok Imagine、FLUX、Gemini 生图模型等）。
5. **你填的每张单价**（计费一节）。

LiteLLM 价目表就是 LiteLLM 公开维护的
[`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)，
很多网关也按它计费。插件在第一次需要时下载（GitHub，或 jsDelivr 镜像），只把其中的生图模型存到
`~/.dsh/cache/images/price-catalog.json`，每周刷新一次。查价时会去掉模型 id 的路由前缀
（`sub2api/gpt-image-2.6-sunburst` → `gpt-image-2.6-sunburst`），同一模型优先取厂商自己的价，
而不是转售商的。下载不带任何关于你或提示词的信息；不想要可以设 `priceCatalog: false`。

都没有的模型不显示费用。估算用的是厂商价目的币种；网关若按订阅或加价计费，会与之不同。

## 看起来不对时

- **`No image model is configured`** —— 打开 图片 → 设置，填上模型。
- **`Provider "…" has no baseURL the images plugin can read`** —— 会话用的供应商不是插件能读到的
  `llm-pi-ai` provider；在设置里换一个，或选「自定义地址」。
- **测试连接列不出生图模型** —— 很多网关提供生图模型却不列出来；直接填 id 生成一张试试。
- **费用不对或没有** —— 设置抽屉里写着这个模型按什么计价；所有价目表都不认识的模型，填一个每张单价。
- **LiteLLM 价目表下载失败** —— 插件要能访问 `raw.githubusercontent.com` 或 `cdn.jsdelivr.net`；
  在计费一节点**下载**重试，或者填一个每张单价。
- **供应商返回 `4xx`/`5xx`** —— 消息是供应商原话：账号不能用这个模型、不支持这个 `size` 或
  `quality`、没额度。按它说的改。
- **模型不画图，用文字描述代替** —— 看 `/images` 是否显示工具已开启，以及 **Plugins → Installed**
  里插件已启用。插件加载时正在进行的回合，下个回合才能看到工具。
- **刷新页面后对话里没有图** —— 这一行由 Web Client 半边绘制；安装或更新后再刷新一次。
- **明明画过，图库却是空的** —— 图库在 `~/.dsh/cache/images/` 下，按 DSH home 分开；换了
  `DSH_HOME` 就是另一个图库。

## 原理

Host 半边把 `generate_image` 注册进 Harness 的工具注册表。被调用时，抽屉里的设置优先于 patch，
从实时 Harness 设置里读供应商的 `baseURL` 和凭据名，通过凭据服务拿到 key（抽屉里存的优先），
发出请求，给回复估价（近处都查不到的模型去本地缓存的 LiteLLM 价目表里查），然后把图存两份：一份进 Harness 附件存储，让
工具结果自带图片（`{ type: 'image' }`）、对话里能显示；一份在 `~/.dsh/cache/images/files/`，并记下
提示词、模型、尺寸和会话，面板通过 Harness web server 上的本机回环路由读的就是这份。带 `frames` 时，精灵图进附件存储，
由它生成的 GIF（`lib/animate.mjs`：PNG 解码、中位切分调色板和 LZW 都是纯 JavaScript，无依赖）进图库。

玩法在 `lib/recipes.mjs`（格式、模板、配方串和 PNG 文本块）和 `lib/library.mjs`（内置、我的和社区玩法合成一个
列表，用 ref 命名：`builtin:…`、`mine:…`、`community:…`、`image:<id>`）。内置玩法连同封面打包在
`recipes/builtin.json`；你自己的在 `~/.dsh/cache/images/recipes/mine.json`。`generate_image` 接收 `recipe` 和
`slots`，套好模板、带上玩法的尺寸和帧数，并把玩法记在图片上；`image_recipes` 供模型搜索、读取、保存和导入玩法。

Client 半边绘制工具卡片、折叠外的结果行、侧栏入口和面板。除了工具调用和结果（Harness 对任何工具
都会记录），不往 Session log 写别的。

<details>
<summary>开发</summary>

仓库结构、测试和发布清单见 [DEVELOPMENT.zh-CN.md](https://github.com/kadaliao/dsh-plugins/blob/main/DEVELOPMENT.zh-CN.md)。

</details>
