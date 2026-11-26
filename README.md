# Images

English | [简体中文](README.zh-CN.md)

**Ask for a picture and get one.**

Gives the conversation model a `generate_image` tool backed by the image model your provider serves.
Say "draw me a poster for the launch" and the picture appears in the conversation, right where it
was made. Everything ever drawn is collected in an **Images** panel: a gallery to browse, enlarge
and download. Its **Recipes** tab holds tested prompt templates to start from — 191 built in, your
own, and the community's — and every recipe can be passed on as a line of text, a picture, or a
community submission.

```
> 画一张海报：深蓝夜空下的灯塔，极简扁平风，标题写 "Night Shift"
  ▸ Completed in 24s
  [ the poster ]
  Here is the poster: a lighthouse under a deep-blue night sky, flat style, titled "Night Shift".
```

## Install

Add the [DSH Plugins](https://github.com/kadaliao/dsh-plugins) index in DeepSeek Harness (**Plugins → Discover → Sources**):

```
https://raw.githubusercontent.com/kadaliao/dsh-plugins/main/marketplace.json
```

then install **Images**. The Discover tab is part of the experimental **Custom plugin markets**
feature; turn it on under **Plugins → Experimental plugins** if you don't see it.

Without Discover, paste the package name into the plugin manager:

```
@kadaliao/dsh-images
```

Or from a terminal with the `dsh` CLI (`--profile desktop` for the desktop app; restart Harness
afterwards):

```
dsh plugin --profile web add @kadaliao/dsh-images
```

For the latest unreleased code, use the Git spec `git+https://github.com/kadaliao/dsh-images.git#main` instead.

Then open **Images** in the left sidebar, click **Settings**, and name the image model (see
[Settings](#settings)). Refresh the page once after installing.

## Updates

Each time you open the Images panel, the plugin checks whether a newer version of itself is out;
opening it again within a minute reuses the answer, and nothing checks in the background. The check
goes through Harness's own plugin manager, the same check as the Versions section in **Plugins**, and
asks the npm registry only about this package. A newer version shows as a bar across the top of the
panel. **Update** has Harness install it, after checking that it works with your Harness; if the
install fails, the version you had is put back. While it updates, the panel closes, and it opens again
once the new version is in. **Later** hides the bar for a day, **Skip this version** until the next
one. Copies installed from a folder or from Git are not checked.

## In the conversation

When you ask for an image, the model calls `generate_image` with a detailed prompt. While the
provider draws, a shimmering placeholder sits in the turn's process fold with the prompt under it.
When the picture arrives it is shown as a row of the conversation, above the model's reply, so it
stays visible after the fold closes. Several images (`n` up to 4) sit side by side.

Hover an image for its controls: **download** and a **⋯ menu** (download, copy the prompt). Click
it to enlarge. In the viewer, the mouse wheel (or a trackpad pinch) zooms around the pointer, from 50% to 1000%; the `−` / `+` buttons in the top bar zoom in steps, and clicking the percentage between them fits the picture back to the screen. Drag a zoomed picture to pan, double-click to toggle 2×. Keys: `+` `-` zoom, `0` fits, `←` `→` step between the images of that call, `Esc` closes.

Under the picture a line says which model drew it, its pixel size and what it cost
(`gpt-image-1.5 · 1024×1024 · ≈ $0.017`). The model also receives the picture (on a model that
takes image input), so it can check its own work and describe what it drew.

## Input images

`generate_image` also takes pictures in. Attach a photo or screenshot, point at a file, or refer to
something it drew earlier, and say what to do with it — "make the cat in this photo wear a party
hat", "put these two characters in one poster", "this character, running, as a GIF". The model
passes them in `images` (up to 16), each one of:

- the attachment id the conversation shows with an image (`sha256:…`),
- the id of an image the tool made earlier (every result names its ids),
- a file path: absolute, `~/…`, or relative to the session's working directory.

With input images the request goes to the provider's `POST /images/edits` (multipart, the same
model and fields) instead of `/images/generations`. Inputs are PNG, JPEG or WebP; an earlier GIF is
sent as its sprite sheet, so an animation can be revised. The tool card shows
`from N input image(s)`. The provider and image model must support edits (OpenAI's `gpt-image-*`
do; many gateways pass it through).

## Animated GIFs

Ask for a GIF, an animation or a sticker ("做一张阿比西尼亚猫追毛线球的 GIF") and the model calls
`generate_image` with `frames` (4, 6, 9 or 16) and, optionally, `frameMs` (time per frame, default
100 ms). Image models only draw stills, so the tool asks for one **sprite sheet** — a grid of that
many frames of the same scene, one continuous loop — then cuts it into frames and encodes a looping
GIF itself (frames up to 480 px, one shared palette, ordered dithering so colours do not flicker).
This costs one image request, the same as a still.

The GIF is what you see in the conversation and the panel (`… · GIF · 16 frames · …`) and what
download saves. The Harness keeps attachments single-frame, so the model is given the sprite sheet
as its picture instead; the sheet is also kept beside the GIF (`<id>-sheet.png`) and removed with it.
Motion is as smooth as the model keeps the frames consistent: simple, repeating motion (running,
waving, bouncing, spinning) works best.

OpenAI's **gpt-image** models (`gpt-image-1.5`, `gpt-image-2`, `gpt-image-2.5-*`, `gpt-image-2.6-*`, …,
with or without a gateway prefix) are known to draw a sheet that lines up. With any other model the GIF is still made, but the result and the
settings drawer warn that the model may not support GIF generation: a model that ignores the grid
gives a GIF that flickers between parts of one picture. More families are added as they are verified.

## The Images panel

**Images** in the left sidebar (or `/images`) opens a gallery of every picture generated in any
conversation, newest first, as a masonry grid of cards. Each card shows the prompt, the model, the
pixel size, the cost and when it was made; the header adds up what was spent. Hover a card for **download** and the **⋯ menu** (download, copy
prompt, make one like this, save as a recipe, download with its recipe, remove from gallery); click it to enlarge and step through the gallery with the arrow keys.
The viewer's **Open conversation** button takes you to the conversation the picture was drawn in
(hover it for that conversation's title). An archived conversation stays shut: the viewer says so
and offers **Unarchive and open** (for a subagent's picture, that unarchives the conversation it ran
under). A deleted conversation is reported as gone.
The panel keeps itself up to date while open, and loads older images as you scroll.

Removing a picture from the gallery deletes the plugin's copy of it; the conversation it came from
still shows it, through the Harness attachment store.

## Recipes

A recipe (玩法) is a tested prompt template with a few blanks, the size or animation it is drawn
with, and credit to whoever made it. The panel's **Recipes** tab lists them as cards with a cover, a
search box and filters by kind (photo, hand-drawn, magazine & poster, infographic, 3D, sticker &
GIF, illustration, product, comic) and by origin (built-in, mine, community).

Open one to see its cover, what it needs and where it came from. Fill in its blanks (each shows its
default), add anything else you want, and press **Start a conversation with it**: a new conversation
opens in the plugin's own **Images** workspace (not the one you were working in) with a message naming
the recipe in the composer. The workspace's folder is `~/.dsh/images/workspace`, made and added to the
sidebar the first time; `workdir` moves it. A recipe that works on your pictures (a photo
to turn into a figurine, line art to colour) says so; attach them before you send. The model calls
`generate_image` with the recipe's ref and the blanks, and the tool fills the template itself, so the
tested wording reaches the image model as written; anything you added goes after it. The picture
is labelled with its recipe in the conversation and the gallery; click the label to open the recipe.

The model can find recipes by itself, too: ask "有什么杂志封面的玩法？" or "draw this as a chalkboard
lesson" and it searches them with the `image_recipes` tool.

**Built-in recipes.** 191, across photo makeovers, hand-drawn, editorial and posters, infographics,
3D, stickers and GIF loops, illustration, product shots and comics — adapted from the most-starred
permissively licensed prompt collections on GitHub —
[JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) (MIT),
[PicoTrex/Awesome-Nano-Banana-images](https://github.com/PicoTrex/Awesome-Nano-Banana-images)
(Apache-2.0), [YouMind-OpenLab/awesome-gpt-image-2](https://github.com/YouMind-OpenLab/awesome-gpt-image-2)
and [awesome-nano-banana-pro-prompts](https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts)
(CC BY 4.0), [ZeroLu/awesome-nanobanana-pro](https://github.com/ZeroLu/awesome-nanobanana-pro)
(MIT), [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) (MIT),
[Evolink-AI/awesome-gpt-image-2-API-Prompts](https://github.com/Evolink-AI/awesome-gpt-image-2-API-Prompts)
(CC0) and [jamez-bondos/awesome-gpt4o-images](https://github.com/jamez-bondos/awesome-gpt4o-images)
(CC BY 4.0) — turned into templates, with brand and studio names replaced by descriptions of the
style. Each names its source and original author; [recipes/CREDITS.md](recipes/CREDITS.md) lists
them all. Every cover was drawn with gpt-image-2.6 from the recipe as shipped; where the model
picked a shape far from the card's, the cover is padded rather than cropped.

**Your own.** In the gallery, a picture's **⋯ menu** has:

- **Make one like this** — the picture's own prompt and settings as a recipe: say what to change and
  start a conversation with it.
- **Save as a recipe** — keeps the picture's prompt and settings under **Mine**, the picture as its
  cover. Edit it there: rewrite a word as `{{name}}` to make it a blank and give it a default. Or
  ask the model to "turn this picture into a recipe" — it writes the blanks itself (`image_recipes`
  `save`).
- **Download with its recipe** — the PNG with its recipe inside (see below).

A built-in or community recipe is copied to **Mine** with **Save to mine**. A recipe of your own
without a cover takes the first picture drawn with it.

## Sharing recipes

Every recipe can be passed on three ways, none of which needs a server:

- **Copy recipe code** — a short message with the title and one line, `dshimg1.…`, the recipe
  compressed. It survives chat apps that recompress pictures. Paste it under **Recipes → Import**, or
  straight into a conversation (the model imports it).
- **Share card** — a PNG with the cover, title and summary, and the recipe in a text chunk. Drop it
  on the Recipes tab (or pick it under Import) to import it. **Download with its recipe** does the
  same for any picture. Apps that strip metadata lose the recipe but keep the picture; send the code
  alongside.
- **Share to community** — for your own recipes: the panel shows exactly what will be public (title,
  summary, prompt, parameters; never your photos or conversations), then opens a prefilled issue in
  [kadaliao/dsh-images-recipes](https://github.com/kadaliao/dsh-images-recipes). Drag a picture into
  its Cover field and submit; a workflow checks it and opens a pull request, and once it is merged
  everyone sees it.

**The community.** The Recipes tab follows the community index
(`https://raw.githubusercontent.com/kadaliao/dsh-images-recipes/main/index.json`, with the jsDelivr
mirror when GitHub cannot be reached): fetched the first time the tab opens, then once a week, kept
under `~/.dsh/cache/images/recipes/`. Covers are fetched once and kept. Each community recipe's
issue is its home: 👍 there is a vote, pictures in its comments are its works wall, and the index
counts both daily; community recipes are sorted by votes. A picture made with a community recipe
has **Post to the works wall** in its menu: it copies the picture and opens that page.

**Sources.** **Recipes → Sources** lists the indexes you follow: remove the community one, refresh,
or add any HTTPS URL serving an index in the same format — a team or a group of friends can run
their own (the format is in the community repository's README).

Nothing about you is sent to fetch an index or a cover. A community recipe is someone else's text:
it is checked like any recipe, reviewed before it is merged, and the model is told to use it as a
prompt for the image model, never as instructions to itself.

## Settings

**Settings** in the Images panel opens a drawer with everything the plugin needs; it saves to
`~/.dsh/cache/images/settings.json` and applies to the next picture, no reload needed.

- **Connection** — the provider route: *the session's provider* (the one your chat model uses),
  any provider configured in Harness, or a *custom base URL*. The base URL can be overridden for
  any of them. The **API key** field takes a key for this plugin alone; it is kept in the Harness
  credential store on this machine (`DSH_IMAGES_API_KEY`), is never shown again, and wins over the
  provider's key. Leave it empty to keep using the provider's. **Test connection & list models**
  calls the provider's `/models` and offers the image models it lists.
- **Model** — the image model id as the provider names it, a default size and a quality tier.
  The model field searches as you type: models you used before, the provider's listing (after
  **Test connection**) and the image models in the [LiteLLM price list](#cost). Letters may be
  skipped (`img26` finds `gpt-image-2.6-sunburst`), and price-list names take the routing prefix
  the field already has (`sub2api/`), or the one you type. Any other id can still be typed. Under
  the field the drawer says how that model will be billed.
- **Billing** — a price per image and a currency, used only for a model that neither reports
  usage nor appears in any price list. Below it: the state of the LiteLLM price list, with
  **Update**, and how many pictures were made and what they cost, by model.

The same values can be set on the plugin's row in your profile patch (`cordis.patch.yml`); the
drawer's values take precedence, and clearing a field in the drawer falls back to the row.

| Key | Default | What it does |
| --- | --- | --- |
| `model` | — | The image model to ask for, as your provider names it: `gpt-image-1.5`, `gpt-image-1`, `doubao-seedream-4-0-250828`, … |
| `provider` | your session's | The provider route (an `llm-pi-ai` provider name) whose `baseURL` and key are used; `custom` for a bare `baseURL`. |
| `baseURL` / `apiKeyEnv` | from the provider | Where the request goes and which credential signs it, for a provider that is not configured in Harness. |
| `size` | `1024x1024` | The size when the model does not ask for another (`1536x1024`, `1024x1536`, `auto`). |
| `quality` | model default | A quality tier (`low`, `medium`, `high`) for models that take one. |
| `pricePerImage` / `currency` | — / `USD` | A flat price for a model the plugin cannot price itself. |
| `priceCatalog` | LiteLLM | The fallback price list: `false` for none, or the URL of another file in LiteLLM's format. |
| `enabled` | `true` | `false` keeps the gallery but offers no tool to the model; `/images on` and `/images off` flip it at runtime. |
| `timeoutMs` | `180000` | How long one request may take. |
| `workdir` | `~/.dsh/images/workspace` | The folder of the Images workspace, where a recipe's conversation starts. |

```yaml
- id: images
  config:
    model: gpt-image-1.5
    # provider: openai
    # size: 1536x1024
```

The request is an OpenAI-compatible `POST <baseURL>/images/generations` with `model`, `prompt`,
`size` and `n`, so any provider or gateway that serves that endpoint works, including local
gateways that route many vendors behind one base URL. The reply may carry the image inline
(`b64_json`) or as a URL; both are taken.

## Cost

Each call is one request to the image model, billed by your provider like any image generation.
The only other request the plugin makes is the price-list download described below. The picture is also placed in the conversation for the model to see, which
costs the image-input tokens of your chat model; a text-only model gets a one-line placeholder
instead.

Every picture carries an estimate of what it cost, from the first of these that applies:

1. **The provider's usage report.** OpenAI's image models return `usage` with input and output
   tokens; the plugin prices them with the vendor's token rates (gpt-image-1.5: text in $5/M,
   image out $32/M; gpt-image-1: $5/M and $40/M; gpt-image-1-mini: $2/M and $8/M). Newer models
   take their rates from the LiteLLM price list (gpt-image-2.6-sunburst: $5/M and $30/M). This is
   exact.
2. **A price the provider states** for the model in its `/models` listing (OpenRouter-style
   `pricing.image`), learned when you test the connection.
3. **The built-in price list** of flat per-image prices (gpt-image-1.5, gpt-image-1,
   gpt-image-1-mini, DALL·E 3 and 2, Doubao Seedream), by quality and shape, checked against the
   vendors' pages on the date the settings drawer shows.
4. **The LiteLLM price list**'s per-image price, for a model none of the above know (Grok Imagine,
   FLUX, Gemini image models, …).
5. **Your price per image** from the Billing section.

The LiteLLM price list is LiteLLM's public
[`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json), which
many gateways bill by. The plugin downloads it the first time a model needs it (from GitHub, or
the jsDelivr mirror), keeps its image models in `~/.dsh/cache/images/price-catalog.json`, and
refreshes it once a week. A model id is looked up without its routing prefix
(`sub2api/gpt-image-2.6-sunburst` → `gpt-image-2.6-sunburst`), with the vendor's own price
preferred over a reseller's. Nothing about you or your prompts is sent; set `priceCatalog: false`
to skip it.

A model none of these cover shows no cost. Estimates are in the vendor's list currency; a gateway
that bills differently (a subscription, a markup) will differ.

## If something looks wrong

- **`No image model is configured`** — open Images → Settings and fill in the model.
- **`Provider "…" has no baseURL the images plugin can read`** — the session's provider is not an
  `llm-pi-ai` provider the plugin can see; pick another in Settings, or choose *Custom base URL*.
- **Test connection lists no image models** — many gateways serve image models without listing
  them; type the id anyway and generate once.
- **The cost looks wrong or is missing** — the Settings drawer says how the model is priced; set a
  price per image for a model no price list knows.
- **The LiteLLM price list could not be downloaded** — the plugin needs `raw.githubusercontent.com`
  or `cdn.jsdelivr.net`; press **Download** under Billing to try again, or set a price per image.
- **The provider answers `4xx`/`5xx`** — the message is the provider's own: a model the account
  cannot use, an unsupported `size` or `quality`, no quota. Change the setting it names.
- **The model does not draw and describes the image in words instead** — check `/images` says the
  tool is on, and that the plugin is enabled in **Plugins → Installed**. A model that was mid-turn
  when the plugin loaded sees the tool on its next turn.
- **The picture is not in the conversation after a page refresh** — the row is drawn by the Web
  Client half; refresh once more after installing or updating.
- **The Images panel is empty though pictures were made** — the gallery lives under
  `~/.dsh/cache/images/`; it is per DSH home, so a different `DSH_HOME` has a different gallery.

## How it works

The Host half registers `generate_image` in the Harness tool registry. On a call it takes the
drawer's settings over the row's, reads the provider's `baseURL` and credential reference from the
live Harness settings, resolves the key through the credentials service (the drawer's own key
first), posts the request, prices the reply (looking the model up in the cached LiteLLM list when
nothing closer knows it), and saves the bytes twice: in the Harness attachment store,
so the tool result carries the image itself (`{ type: 'image' }`) and the conversation shows it; and
under `~/.dsh/cache/images/files/`, with an index of prompt, model, size and session, which is what
the panel reads through loopback routes on the Harness web server. With `frames`, the
sprite sheet goes to the attachment store and the GIF built from it (`lib/animate.mjs`: PNG decoding,
median-cut palette and LZW in plain JavaScript, no dependencies) to the gallery.

Recipes live in `lib/recipes.mjs` (the format, templates, recipe codes and PNG text chunks) and
`lib/library.mjs` (built-in, own and community recipes behind one list of refs: `builtin:…`,
`mine:…`, `community:…`, `image:<id>`). The built-in ones ship in `recipes/builtin.json` with their
covers; your own are in `~/.dsh/cache/images/recipes/mine.json`. `generate_image` takes `recipe` and
`slots`, renders the template, applies its size and frames, and records the recipe on the picture;
`image_recipes` searches, reads, saves and imports them for the model.

The Client half draws the tool's card, the result row outside the turn fold, the sidebar entry and
the panel. Nothing is written to the Session log beyond the tool call and its result, which the
Harness records as for any tool.

<details>
<summary>Development</summary>

Repository layout, tests, and the release checklist are in
[DEVELOPMENT.md](https://github.com/kadaliao/dsh-plugins/blob/main/DEVELOPMENT.md).

</details>
