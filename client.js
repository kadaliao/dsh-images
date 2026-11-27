window.__ModuleLoader__.load({
  id: '@kadaliao/dsh-images',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useRef, useState } = React;
    let ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch {
      ReactDOM = null;
    }
    // The product's own controls when this harness serves them; plain ones otherwise.
    let primitives = null;
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    } catch {
      primitives = null;
    }

    const NS = 'images';
    // This client half's version; test/updates.test.mjs keeps it equal to package.json.
    const VERSION = '0.9.0';
    // The version and GitHub link beside the panel's title, from the shared update block once apply(ctx) has run.
    let About = null;
    const TOOL_NAME = 'generate_image';
    const PANEL_ID = 'images';
    const LIST_ROUTE = '/__dsh_images/list';
    const FILE_ROUTE = '/__dsh_images/file/';
    const DELETE_ROUTE = '/__dsh_images/delete';
    const STATE_ROUTE = '/__dsh_images/state';
    const SETTINGS_ROUTE = '/__dsh_images/settings';
    const MODELS_ROUTE = '/__dsh_images/models';
    const CATALOG_ROUTE = '/__dsh_images/catalog';
    const RECIPES_ROUTE = '/__dsh_images/recipes';
    const WORKSPACE_ROUTE = '/__dsh_images/workspace';
    const SIZES = ['1024x1024', '1536x1024', '1024x1536'];
    const QUALITIES = ['low', 'medium', 'high'];
    const PAGE = 40;
    const POLL_MS = 4000;

    const C = {
      base: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      layer3: 'var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))',
      border: 'var(--dsw-alias-border-l2, rgba(127,127,127,.25))',
      border1: 'var(--dsw-alias-border-l1, rgba(127,127,127,.15))',
      label: 'var(--dsw-alias-brand-primary)',
      primary: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      faint: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
      hover: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12))',
      // The host's accent for a picked filter, and its lift for a picked segment.
      accent: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
      lift: 'var(--dsw-elevation-soft, 0 1px 2px rgba(0,0,0,.12))',
      error: 'var(--dsw-alias-state-error-primary, #f25a5a)',
    };
    const FONT = 'var(--dsh-content-font-size, 13.5px)';
    const SMALL = 'var(--dsh-content-font-size-secondary, 12.5px)';

    const getJson = (url) =>
      fetch(url, { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null));
    const postJson = (url, body) =>
      fetch(url, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }).then((r) => (r.ok ? r.json() : null));

    const fileUrl = (id) => `${FILE_ROUTE}${encodeURIComponent(id)}`;
    const ext = (mediaType) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[mediaType] ?? 'png');

    /** Save one image through the browser's download flow. */
    function download(item) {
      try {
        const a = document.createElement('a');
        a.href = item.url ? `${item.url}${item.url.includes('?') ? '&' : '?'}download=1` : item.src;
        a.download = `${item.id ?? 'image'}.${ext(item.mediaType)}`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        // Nothing to do without a document.
      }
    }

    function copyText(text) {
      try {
        if (typeof primitives?.writeClipboard === 'function') return void primitives.writeClipboard(text);
        if (navigator?.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(() => {});
      } catch {
        // The clipboard is a convenience.
      }
    }

    /** `$0.13` / `¥0.20`, rounded to what matters. */
    function fmtMoney(amount, currency) {
      const n = Number(amount);
      if (!Number.isFinite(n)) return '';
      const sign = currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : currency === 'EUR' ? '€' : `${currency ?? ''} `;
      const digits = n >= 1 ? 2 : n >= 0.01 ? 3 : 4;
      return `${sign}${n.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`;
    }
    const fmtCost = (cost) => (cost && Number.isFinite(cost.amount) ? `≈ ${fmtMoney(cost.amount, cost.currency)}` : '');
    /** `≈ $1.23 · ¥4.5` over a `{USD: n, CNY: n}` map, '' when empty. */
    const fmtTotals = (totals) =>
      Object.entries(totals ?? {})
        .filter(([, v]) => Number.isFinite(v) && v > 0)
        .map(([c, v]) => fmtMoney(v, c))
        .join(' · ');
    /** The line under a picture: model · size · cost. */
    const metaLine = (t, item) =>
      [item.model, item.width && item.height ? `${item.width}×${item.height}` : null, item.animation?.frames ? `GIF · ${t('frames', { n: item.animation.frames })}` : null, fmtCost(item.cost), item.createdAt ? fmtWhen(t, item.createdAt) : null].filter(Boolean).join(' · ');

    function fmtWhen(t, at, now = Date.now()) {
      const ms = Math.max(0, now - at);
      if (ms < 60_000) return t('justNow');
      if (ms < 3_600_000) return t('minutesAgo', { n: Math.round(ms / 60_000) });
      if (ms < 86_400_000) return t('hoursAgo', { n: Math.round(ms / 3_600_000) });
      if (ms < 7 * 86_400_000) return t('daysAgo', { n: Math.round(ms / 86_400_000) });
      try {
        return new Date(at).toLocaleDateString();
      } catch {
        return '';
      }
    }

    // --- icons -----------------------------------------------------------------

    const svg = (size, paths, extra = {}) =>
      h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          ...extra,
        },
        ...paths.map((d, i) => h('path', { key: i, d })),
      );
    const DotsIcon = ({ size = 16 }) => svg(size, ['M5 12h.01M12 12h.01M19 12h.01'], { strokeWidth: 3 });
    const DownloadIcon = ({ size = 16 }) => svg(size, ['M12 4v11', 'M7 10l5 5 5-5', 'M4 19h16']);
    const CloseIcon = ({ size = 16 }) => svg(size, ['M6 6l12 12', 'M18 6L6 18']);
    const GearIcon = ({ size = 15 }) =>
      svg(size, ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z']);
    const ZoomInIcon = ({ size = 16 }) => svg(size, ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4', 'M11 8v6', 'M8 11h6']);
    const ZoomOutIcon = ({ size = 16 }) => svg(size, ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4', 'M8 11h6']);
    const ChevronIcon = ({ size = 20, dir = 1 }) => svg(size, [dir > 0 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7']);
    const ChatIcon = ({ size = 16 }) => svg(size, ['M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.6A7.5 7.5 0 1 1 20 11.5z']);
    function ImagesGlyph(props) {
      const size = Number(props?.size) > 0 ? Number(props.size) : 18;
      const ink = props?.active ? C.label : 'currentColor';
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: ink, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('rect', { key: 'f', x: 3, y: 5, width: 18, height: 14, rx: 2.5 }),
        h('path', { key: 'm', d: 'M4.5 17.5l5-5.5 3.5 4 2.5-2.5 4 4' }),
        h('circle', { key: 's', cx: 16, cy: 9.5, r: 1.6, fill: props?.active ? C.label : 'none' }),
      );
    }

    // --- the hover menu on a tile ---------------------------------------------------

    function IconButton({ onClick, title, children, dark = false }) {
      return h(
        'button',
        {
          type: 'button',
          title,
          'aria-label': title,
          onClick: (e) => {
            e.stopPropagation();
            onClick?.(e);
          },
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#fff',
            background: dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(6px)',
          },
        },
        children,
      );
    }

    /**
     * The small menu a tile's corner button opens: download, copy the prompt, and
     * (in the gallery) delete. Closes on a click outside or Escape.
     */
    function TileMenu({ t, actions, onClose }) {
      const ref = useRef(null);
      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const away = (e) => {
          if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        const key = (e) => {
          if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', away, true);
        document.addEventListener('keydown', key, true);
        return () => {
          document.removeEventListener('mousedown', away, true);
          document.removeEventListener('keydown', key, true);
        };
      }, []);
      return h(
        'div',
        {
          ref,
          role: 'menu',
          'data-dsh-images-menu': true,
          onClick: (e) => e.stopPropagation(),
          style: {
            position: 'absolute',
            top: 40,
            right: 8,
            zIndex: 5,
            minWidth: 150,
            padding: 4,
            borderRadius: 10,
            background: C.layer3,
            border: `1px solid ${C.border}`,
            boxShadow: '0 8px 28px rgba(0,0,0,.28)',
            fontSize: SMALL,
          },
        },
        actions.map((a) =>
          h(
            'button',
            {
              key: a.id,
              type: 'button',
              role: 'menuitem',
              onClick: () => {
                onClose();
                a.run();
              },
              style: {
                display: 'block',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                fontSize: SMALL,
                padding: '6px 10px',
                border: 'none',
                borderRadius: 7,
                background: 'transparent',
                color: a.danger ? C.error : C.primary,
                cursor: 'pointer',
                lineHeight: 1.7,
                whiteSpace: 'nowrap',
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = C.hover;
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = 'transparent';
              },
            },
            t(a.id),
          ),
        ),
      );
    }

    /**
     * One image with its hover controls: a download button and a menu in the top-right
     * corner, the whole tile opening the lightbox. `item` carries `src`, `id`,
     * `mediaType`, `width`, `height`, `prompt`.
     */
    function Tile({ t, item, onOpen, onDelete, caption = null, radius = 12, maxHeight, extraActions = [] }) {
      const [hover, setHover] = useState(false);
      const [menu, setMenu] = useState(false);
      const ratio = item.width > 0 && item.height > 0 ? `${item.width} / ${item.height}` : undefined;
      const actions = [
        { id: 'download', run: () => download(item) },
        ...(item.prompt ? [{ id: 'copyPrompt', run: () => copyText(item.prompt) }] : []),
        ...extraActions,
        ...(onDelete ? [{ id: 'delete', run: () => onDelete(item), danger: true }] : []),
      ];
      const showControls = hover || menu;
      // With a height cap, the tile is as wide as the picture at that height, so a
      // portrait image gets a narrow tile and a landscape one a wide tile.
      const fitWidth = maxHeight && item.width > 0 && item.height > 0 ? Math.round((maxHeight * item.width) / item.height) : undefined;
      return h(
        'figure',
        {
          'data-dsh-images-tile': item.id,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: {
            position: 'relative',
            margin: 0,
            breakInside: 'avoid',
            borderRadius: radius,
            overflow: 'hidden',
            background: C.layer2,
            border: `1px solid ${C.border1}`,
            ...(fitWidth !== undefined ? { width: `min(${fitWidth}px, 100%)` } : {}),
          },
        },
        h(
          'div',
          {
            role: 'button',
            tabIndex: 0,
            title: t('enlarge'),
            onClick: () => onOpen?.(item),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.(item);
              }
            },
            style: { position: 'relative', display: 'block', cursor: 'zoom-in', aspectRatio: ratio, ...(fitWidth === undefined ? { maxHeight } : {}), lineHeight: 0 },
          },
          h('img', {
            src: item.src,
            alt: item.prompt ?? '',
            loading: 'lazy',
            decoding: 'async',
            draggable: false,
            style: { display: 'block', width: '100%', height: ratio ? '100%' : 'auto', ...(fitWidth === undefined ? { maxHeight } : {}), objectFit: 'cover' },
          }),
          h(
            'div',
            {
              style: {
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 6,
                opacity: showControls ? 1 : 0,
                transition: 'opacity .15s',
                pointerEvents: showControls ? 'auto' : 'none',
              },
            },
            h(IconButton, { key: 'dl', title: t('download'), onClick: () => download(item) }, h(DownloadIcon)),
            h(IconButton, { key: 'more', title: t('more'), onClick: () => setMenu((v) => !v) }, h(DotsIcon)),
          ),
          menu ? h(TileMenu, { t, actions, onClose: () => setMenu(false) }) : null,
        ),
        caption,
      );
    }

    // --- the lightbox ----------------------------------------------------------------

    /** Zoom range of the viewer, as a multiple of the fitted size. */
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 10;
    const ZOOM_STEP = 1.25;
    const FIT = { s: 1, x: 0, y: 0 };
    const clampZoom = (s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));

    /**
     * The view after zooming to `next` around a point `dx, dy` away from the
     * image's current centre on screen: that point stays under the cursor. At or
     * below the fitted size the image re-centres.
     */
    function zoomView(view, next, dx = 0, dy = 0) {
      const s = clampZoom(next);
      if (s <= 1) return { s, x: 0, y: 0 };
      const k = 1 - s / view.s;
      return { s, x: view.x + dx * k, y: view.y + dy * k };
    }

    /**
     * The viewer. `onOpenSession(item)`, given only by the gallery, adds a button
     * that opens the conversation the picture was drawn in. When that conversation
     * cannot be opened it returns a notice `{key, action?}` to show; an action
     * `{key, run}` is a button on the notice whose `run()` resolves to the next
     * notice, or null once it has done its work.
     */
    function Lightbox({ t, items, index, onClose, onStep, onOpenSession, sessionTitle }) {
      const item = items[index];
      const [view, setView] = useState(FIT);
      // A notice belongs to the picture it was about; stepping on leaves it behind.
      const [notice, setNotice] = useState(null);
      const drag = useRef(null);
      // A new picture opens fitted.
      useEffect(() => {
        setView(FIT);
      }, [index]);

      /** Zoom around a client point, or the image's centre without one. */
      const zoomAt = (factor, img, clientX, clientY) => {
        let dx = 0;
        let dy = 0;
        if (img && typeof img.getBoundingClientRect === 'function' && clientX !== undefined) {
          const r = img.getBoundingClientRect();
          dx = clientX - (r.left + r.width / 2);
          dy = clientY - (r.top + r.height / 2);
        }
        setView((v) => zoomView(v, v.s * factor, dx, dy));
      };

      // The wheel zooms. React's own wheel listener is passive and cannot stop the
      // page (or a trackpad pinch) from scrolling and zooming the app, so a native
      // one is attached to the stage.
      const stage = useRef(null);
      if (stage.current === null) {
        const box = { el: null, listener: null };
        box.ref = (el) => {
          if (box.el && box.listener) box.el.removeEventListener('wheel', box.listener);
          box.el = el;
          if (!el) return;
          box.listener = (e) => {
            e.preventDefault();
            // A pinch arrives as ctrl+wheel with small deltas; a mouse wheel as large ones.
            const speed = e.ctrlKey ? 0.01 : 0.0015;
            const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            const img = typeof el.querySelector === 'function' ? el.querySelector('img') : null;
            zoomAt(Math.exp(-delta * speed), img, e.clientX, e.clientY);
          };
          el.addEventListener('wheel', box.listener, { passive: false });
        };
        stage.current = box;
      }

      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const key = (e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowRight' && index < items.length - 1) onStep(index + 1);
          else if (e.key === 'ArrowLeft' && index > 0) onStep(index - 1);
          else if (e.key === '+' || e.key === '=') setView((v) => zoomView(v, v.s * ZOOM_STEP));
          else if (e.key === '-' || e.key === '_') setView((v) => zoomView(v, v.s / ZOOM_STEP));
          else if (e.key === '0') setView(FIT);
          else return;
          e.preventDefault();
          e.stopPropagation();
        };
        document.addEventListener('keydown', key, true);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.removeEventListener('keydown', key, true);
          document.body.style.overflow = previous;
        };
      }, [index, items.length]);
      if (!item) return null;
      const meta = metaLine(t, item);
      const zoomed = view.s > 1;
      const nav = (dir) =>
        h(
          'button',
          {
            type: 'button',
            'aria-label': dir > 0 ? t('next') : t('previous'),
            onClick: (e) => {
              e.stopPropagation();
              onStep(index + dir);
            },
            style: {
              position: 'absolute',
              top: '50%',
              [dir > 0 ? 'right' : 'left']: 18,
              transform: 'translateY(-50%)',
              zIndex: 1,
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              background: 'rgba(0,0,0,.45)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          h(ChevronIcon, { dir }),
        );
      const zoomBar = h(
        'div',
        {
          'data-dsh-images-zoom': true,
          onClick: (e) => e.stopPropagation(),
          style: { display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 10, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)' },
        },
        h(IconButton, { key: 'out', title: t('zoomOut'), dark: true, onClick: () => setView((v) => zoomView(v, v.s / ZOOM_STEP)) }, h(ZoomOutIcon, { size: 18 })),
        h(
          'button',
          {
            type: 'button',
            title: t('zoomReset'),
            'aria-label': t('zoomReset'),
            onClick: (e) => {
              e.stopPropagation();
              setView(FIT);
            },
            style: { minWidth: 48, height: 28, padding: '0 4px', border: 'none', borderRadius: 8, background: 'transparent', color: '#fff', font: 'inherit', fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' },
          },
          `${Math.round(view.s * 100)}%`,
        ),
        h(IconButton, { key: 'in', title: t('zoomIn'), dark: true, onClick: () => setView((v) => zoomView(v, v.s * ZOOM_STEP)) }, h(ZoomInIcon, { size: 18 })),
      );
      const title = onOpenSession && item.sessionId ? sessionTitle?.(item.sessionId) : undefined;
      const openSession =
        onOpenSession && item.sessionId
          ? h(
              'button',
              {
                type: 'button',
                title: title ? t('openSessionTitled', { title }) : t('openSession'),
                'data-dsh-images-open-session': item.sessionId,
                onClick: (e) => {
                  e.stopPropagation();
                  const next = onOpenSession(item);
                  setNotice(next ? { at: index, ...next } : null);
                },
                style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px 0 10px', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', font: 'inherit', fontSize: 12.5, whiteSpace: 'nowrap' },
              },
              h(ChatIcon),
              t('openSession'),
            )
          : null;
      const node = h(
        'div',
        {
          role: 'dialog',
          'aria-modal': true,
          'aria-label': t('viewer'),
          'data-dsh-images-lightbox': true,
          onClick: onClose,
          style: { position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.86)', display: 'flex', flexDirection: 'column', color: '#fff' },
        },
        h(
          'div',
          { style: { position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 } },
          zoomBar,
          openSession,
          h(IconButton, { key: 'dl', title: t('download'), dark: true, onClick: () => download(item) }, h(DownloadIcon, { size: 18 })),
          h(IconButton, { key: 'x', title: t('close'), dark: true, onClick: onClose }, h(CloseIcon, { size: 18 })),
        ),
        index > 0 ? nav(-1) : null,
        index < items.length - 1 ? nav(1) : null,
        h(
          'div',
          {
            ref: stage.current.ref,
            'data-dsh-images-stage': true,
            style: { flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 72px 12px', overflow: 'hidden' },
          },
          h('img', {
            src: item.src,
            alt: item.prompt ?? '',
            draggable: false,
            onClick: (e) => e.stopPropagation(),
            // Double-click toggles between fitted and 2× at the point clicked.
            onDoubleClick: (e) => {
              e.stopPropagation();
              if (view.s !== 1) setView(FIT);
              else zoomAt(2, e.currentTarget, e.clientX, e.clientY);
            },
            // Dragging pans a zoomed picture.
            onPointerDown: (e) => {
              if (!zoomed || e.button !== 0) return;
              e.preventDefault();
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
              e.currentTarget.setPointerCapture?.(e.pointerId);
            },
            onPointerMove: (e) => {
              const d = drag.current;
              if (!d || d.id !== e.pointerId) return;
              setView((v) => ({ ...v, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
            },
            onPointerUp: (e) => {
              if (drag.current?.id === e.pointerId) drag.current = null;
            },
            onPointerCancel: () => {
              drag.current = null;
            },
            style: {
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 6,
              boxShadow: '0 12px 48px rgba(0,0,0,.5)',
              cursor: zoomed ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
              transformOrigin: 'center center',
              transition: drag.current ? 'none' : 'transform .12s ease-out',
              touchAction: 'none',
              userSelect: 'none',
              willChange: 'transform',
            },
          }),
        ),
        h(
          'div',
          { onClick: (e) => e.stopPropagation(), style: { position: 'relative', zIndex: 1, padding: '0 72px 22px', textAlign: 'center', fontSize: SMALL, lineHeight: 1.5 } },
          item.prompt ? h('div', { style: { maxWidth: 820, margin: '0 auto', color: 'rgba(255,255,255,.92)', userSelect: 'text' } }, item.prompt) : null,
          meta ? h('div', { style: { marginTop: 4, color: 'rgba(255,255,255,.55)' } }, `${meta}${items.length > 1 ? ` · ${index + 1} / ${items.length}` : ''}`) : null,
        ),
        notice && notice.at === index
          ? h(PanelToast, {
              text: t(notice.key),
              onDone: () => setNotice(null),
              style: { top: 60, bottom: 'auto', zIndex: 3 },
              action: notice.action
                ? {
                    label: notice.busy ? t('unarchiving') : t(notice.action.key),
                    busy: notice.busy === true,
                    run: () => {
                      const { at, action } = notice;
                      setNotice((n) => (n ? { ...n, busy: true } : n));
                      Promise.resolve()
                        .then(action.run)
                        .then(
                          (next) => setNotice(next ? { at, ...next } : null),
                          () => setNotice({ at, key: 'unarchiveFailed' }),
                        );
                    },
                  }
                : undefined,
            })
          : null,
      );
      return ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' ? ReactDOM.createPortal(node, document.body) : node;
    }

    /** Lightbox state shared by a set of tiles: which one is open. */
    function useLightbox() {
      const [at, setAt] = useState(-1);
      return { at, open: (items, item) => setAt(items.indexOf(item)), close: () => setAt(-1), step: setAt };
    }

    const WARN = 'var(--dsw-alias-state-warn-primary, #f59e0b)';
    /** The line under a GIF drawn by a model not known to keep to the frame grid. */
    const gifWarning = (t, meta, model) =>
      meta && meta.gifUnverified ? h('div', { 'data-dsh-images-gif-warning': true, style: { fontSize: 11.5, color: WARN, lineHeight: 1.5 } }, t('gifUnverified', { model: model || meta.model || '' })) : null;

    // --- the tool call in the conversation -----------------------------------------

    function parseArgs(block) {
      const raw = block?.argsRaw ?? block?.call?.argsRaw;
      if (typeof raw === 'string' && raw !== '') {
        try {
          return JSON.parse(raw);
        } catch {
          // Partial JSON while the call streams.
        }
      }
      const args = block?.args;
      if (args && typeof args === 'object') {
        try {
          return typeof args.toJSON === 'function' ? args.toJSON() : { ...args };
        } catch {
          return {};
        }
      }
      return {};
    }

    /** The images of one settled result: gallery ids from the meta, else attachment refs. */
    function resultImages(block) {
      const meta = block?.meta && typeof block.meta === 'object' ? block.meta : {};
      const refs = (Array.isArray(block?.content) ? block.content : []).filter((b) => b && b.type === 'image' && b.attachment);
      const ids = Array.isArray(meta.ids) ? meta.ids.map(String) : [];
      const out = [];
      const count = Math.max(ids.length, refs.length);
      for (let i = 0; i < count; i += 1) {
        const ref = refs[i]?.attachment;
        // The gallery file's own facts: for a GIF the attachment is its sprite sheet.
        const media = Array.isArray(meta.media) && meta.media[i] && typeof meta.media[i] === 'object' ? meta.media[i] : undefined;
        out.push({
          id: ids[i] ?? ref?.attachmentId ?? `${block.callId}:${i}`,
          url: ids[i] ? fileUrl(ids[i]) : undefined,
          attachment: ref,
          mediaType: media?.mediaType ?? ref?.mediaType ?? 'image/png',
          width: media?.width ?? ref?.width ?? 0,
          height: media?.height ?? ref?.height ?? 0,
          ...(media?.frames ? { animation: { frames: media.frames } } : {}),
          prompt: typeof meta.prompt === 'string' ? meta.prompt : undefined,
          model: typeof meta.model === 'string' ? meta.model : undefined,
          cost: meta.cost && typeof meta.cost === 'object' && count > 0 ? { ...meta.cost, amount: Number(meta.cost.amount) / count } : undefined,
        });
      }
      return out;
    }

    function resultText(block) {
      return (Array.isArray(block?.content) ? block.content : [])
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }

    /** An image whose bytes come through the session's attachment loader when no gallery URL names it. */
    function useSources(images, loadImage) {
      const [srcs, setSrcs] = useState({});
      useEffect(() => {
        let live = true;
        for (const img of images) {
          if (img.url || !img.attachment || typeof loadImage !== 'function') continue;
          const peeked = typeof loadImage.peek === 'function' ? loadImage.peek(img.attachment) : undefined;
          if (peeked) {
            setSrcs((s) => (s[img.id] === peeked ? s : { ...s, [img.id]: peeked }));
            continue;
          }
          Promise.resolve()
            .then(() => loadImage(img.attachment))
            .then((src) => {
              if (live && typeof src === 'string') setSrcs((s) => ({ ...s, [img.id]: src }));
            })
            .catch(() => {});
        }
        return () => {
          live = false;
        };
      }, [images.map((i) => i.id).join('|')]);
      return images.map((img) => ({ ...img, src: img.url ?? srcs[img.id] })).filter((img) => img.src);
    }

    function GenerateImageView(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      const { phase, block } = props;
      const args = parseArgs(block);
      const settled = phase === 'result';
      // With a recipe the call's own prompt is only extra direction; the result has the whole one.
      const prompt = typeof args.prompt === 'string' && args.prompt !== '' ? args.prompt : settled && typeof block?.meta?.prompt === 'string' ? block.meta.prompt : '';
      const recipeTitle = block?.meta?.recipe?.title ? pickText(block.meta.recipe.title, t('lang')) : typeof args.recipe === 'string' ? args.recipe : '';
      const images = settled ? resultImages(block) : [];
      const shown = useSources(images, props.loadImage);
      const box = useLightbox();
      const [expanded, setExpanded] = useState(false);

      const head = h(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: SMALL, color: C.muted, minWidth: 0 } },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, color: settled && !block.isError ? C.label : C.faint, fontWeight: 600, flex: 'none' } }, h(ImagesGlyph, { size: 14, active: settled && !block.isError }), t('toolTitle')),
        settled && !block.isError && shown[0]?.model
          ? h('span', { style: { color: C.faint, flex: 'none' } }, [shown[0].model, block.meta?.cost ? fmtCost(block.meta.cost) : null].filter(Boolean).join(' · '))
          : null,
        recipeTitle ? h('span', { 'data-dsh-images-recipe-chip': true, style: { color: C.faint, flex: 'none' } }, t('withRecipe', { title: recipeTitle })) : null,
        Array.isArray(args.images) && args.images.length > 0 ? h('span', { style: { color: C.faint, flex: 'none' } }, t('fromInputs', { n: args.images.length })) : null,
        !settled ? h('span', { style: { color: C.faint, fontStyle: 'italic' } }, t(phase === 'preparing' ? 'preparing' : 'generating')) : null,
      );

      const long = prompt.length > 160;
      const promptRow = prompt
        ? h(
            'div',
            {
              onClick: long ? () => setExpanded((v) => !v) : undefined,
              title: long && !expanded ? prompt : undefined,
              style: {
                fontSize: SMALL,
                color: C.muted,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                userSelect: 'text',
                cursor: long ? 'pointer' : undefined,
                ...(long && !expanded ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
              },
            },
            prompt,
          )
        : null;

      let body;
      if (!settled) {
        body = h('div', {
          'data-dsh-images-pending': true,
          style: { width: 220, maxWidth: '100%', aspectRatio: '1 / 1', borderRadius: 12, background: `linear-gradient(110deg, ${C.layer2} 30%, ${C.layer3} 50%, ${C.layer2} 70%)`, backgroundSize: '200% 100%', animation: 'dsh-images-shimmer 1.6s linear infinite' },
        });
      } else if (block.isError) {
        body = h('div', { style: { fontSize: SMALL, color: C.error, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' } }, resultText(block) || t('failed'));
      } else if (shown.length === 0) {
        body = h('div', { style: { fontSize: SMALL, color: C.faint } }, images.length > 0 ? t('loading') : resultText(block) || t('noImage'));
      } else {
        body = h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
          shown.map((img) =>
            h(
              'div',
              { key: img.id, style: { maxWidth: '100%', minWidth: 0 } },
              h(Tile, { t, item: img, onOpen: (item) => box.open(shown, item), maxHeight: shown.length > 1 ? 260 : 420 }),
            ),
          ),
        );
      }

      return h(
        'div',
        { 'data-dsh-images-call': block?.callId, style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0 4px', fontSize: FONT, color: C.primary } },
        h('style', null, '@keyframes dsh-images-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}'),
        head,
        promptRow,
        body,
        settled && !block.isError ? gifWarning(t, block.meta) : null,
        box.at >= 0 ? h(Lightbox, { t, items: shown, index: box.at, onClose: box.close, onStep: box.step }) : null,
      );
    }

    // --- the result row outside the fold ----------------------------------------------
    //
    // The tool card above lives inside the turn's process fold, which closes once the
    // turn completes. The picture itself is the answer, so a second node carries it
    // at the `turn` level, beside the model's text, where the fold cannot hide it.

    const RESULT_KIND = 'images-result';
    // Call ids of generate_image calls seen in each Session's feed, so a result can be told apart.
    const ownCalls = new Set();

    function isOwnResult(event) {
      if (event?.type !== 'tool/result' || event.surfaceOp !== 'append') return false;
      const data = event.data ?? {};
      const callId = String(data.message?.source?.callId ?? data.message?.toolCallId ?? '');
      if (callId !== '' && ownCalls.has(callId)) return true;
      const meta = data.meta;
      return Boolean(meta && Array.isArray(meta.ids) && typeof meta.prompt === 'string');
    }

    const imagesResultDefinition = {
      kind: RESULT_KIND,
      target: 'chat',
      match: (event) => {
        if (event?.type === 'tool/call') {
          if (event.data?.name === TOOL_NAME) ownCalls.add(String(event.data.callId));
          return null;
        }
        if (!isOwnResult(event)) return null;
        const data = event.data;
        return { id: String(data.message?.source?.callId ?? data.message?.toolCallId ?? event.seq), role: 'start' };
      },
      start: (_context, match) => {
        const data = match.event.data ?? {};
        return {
          callId: String(data.message?.source?.callId ?? data.message?.toolCallId ?? ''),
          seq: match.event.seq,
          time: match.event.time,
          content: Array.isArray(data.message?.content) ? data.message.content : [],
          isError: data.message?.isError === true,
          meta: data.meta && typeof data.meta === 'object' ? data.meta : {},
        };
      },
      update: (context) => context.state,
      buildViewNode: (context) => {
        const state = context.state;
        if (state === undefined || state.isError || resultImages(state).length === 0) return null;
        return {
          key: context.key,
          kind: RESULT_KIND,
          id: context.id,
          target: 'chat',
          // A fraction after the result keeps the row where the picture was made.
          anchorSeq: state.seq + 0.2,
          location: context.start.location,
          visibility: 'visible',
          // Turn level: outside the process fold, like the model's own answer.
          groupTree: 'turn',
          data: state,
        };
      },
    };

    function ImagesResultRow(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      const state = props.node?.data ?? {};
      const images = resultImages(state);
      const shown = useSources(images, props.loadImage);
      const box = useLightbox();
      if (shown.length === 0) return null;
      return h(
        'div',
        { 'data-dsh-images-row': state.callId, style: { display: 'flex', flexWrap: 'wrap', gap: 10, padding: '6px 0 10px' } },
        shown.map((img) =>
          h(
            'div',
            { key: img.id, style: { maxWidth: '100%', minWidth: 0 } },
            h(Tile, { t, item: img, onOpen: (item) => box.open(shown, item), maxHeight: shown.length > 1 ? 260 : 480 }),
            h('div', { style: { marginTop: 5, fontSize: 11.5, color: C.faint, letterSpacing: 0.1 } }, metaLine(t, img)),
          ),
        ),
        gifWarning(t, state.meta) ? h('div', { style: { flexBasis: '100%' } }, gifWarning(t, state.meta)) : null,
        box.at >= 0 ? h(Lightbox, { t, items: shown, index: box.at, onClose: box.close, onStep: box.step }) : null,
      );
    }

    // --- the gallery panel -----------------------------------------------------------

    function ImagesPanel(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      const [items, setItems] = useState(null);
      const [hasMore, setHasMore] = useState(false);
      const [total, setTotal] = useState(0);
      const [failed, setFailed] = useState(false);
      const [loadingMore, setLoadingMore] = useState(false);
      const [totals, setTotals] = useState({});
      const [settingsOpen, setSettingsOpen] = useState(false);
      // A notice: a string, or {text, action} for one with a button.
      const [toast, setToast] = useState('');
      const [tab, setTabState] = useState(() => {
        try {
          return globalThis.localStorage?.getItem(TAB_KEY) === 'recipes' ? 'recipes' : 'gallery';
        } catch {
          return 'gallery';
        }
      });
      const [recipes, setRecipes] = useState(null);
      const [recipesFailed, setRecipesFailed] = useState(false);
      const [sheet, setSheet] = useState(null);
      const [dialog, setDialog] = useState(null);
      const lang = t('lang');
      const drafts = props.drafts;
      const box = useLightbox();
      const alive = useRef(true);
      const itemsRef = useRef(items);
      itemsRef.current = items;
      const scroller = useRef(null);

      const decorate = (it) => ({ ...it, src: it.url });

      const refresh = () =>
        getJson(`${LIST_ROUTE}?limit=${PAGE}`)
          .then((body) => {
            if (!alive.current) return;
            if (body === null || !Array.isArray(body.items)) {
              if (itemsRef.current === null) setFailed(true);
              return;
            }
            setFailed(false);
            setTotal(body.total ?? body.items.length);
            getJson(STATE_ROUTE).then((st) => alive.current && st?.totals && setTotals(st.totals)).catch(() => {});
            const fresh = body.items.map(decorate);
            const known = itemsRef.current;
            if (known === null) {
              setItems(fresh);
              setHasMore(body.hasMore === true);
              return;
            }
            // Keep what is loaded; add what is new in front, drop what is gone from the first page.
            const seen = new Set(fresh.map((i) => i.id));
            const firstPageIds = new Set(known.slice(0, PAGE).map((i) => i.id));
            const added = fresh.filter((i) => !firstPageIds.has(i.id));
            const kept = known.filter((i, at) => at >= PAGE || seen.has(i.id));
            if (added.length === 0 && kept.length === known.length) return;
            setItems([...added, ...kept]);
          })
          .catch(() => alive.current && itemsRef.current === null && setFailed(true));

      const loadMore = () => {
        const known = itemsRef.current;
        if (!hasMore || loadingMore || !known || known.length === 0) return;
        setLoadingMore(true);
        getJson(`${LIST_ROUTE}?limit=${PAGE}&before=${encodeURIComponent(known[known.length - 1].id)}`)
          .then((body) => {
            if (!alive.current || body === null || !Array.isArray(body.items)) return;
            const have = new Set((itemsRef.current ?? []).map((i) => i.id));
            setItems([...(itemsRef.current ?? []), ...body.items.filter((i) => !have.has(i.id)).map(decorate)]);
            setHasMore(body.hasMore === true);
          })
          .catch(() => {})
          .finally(() => alive.current && setLoadingMore(false));
      };

      useEffect(() => {
        alive.current = true;
        refresh();
        const timer = setInterval(() => {
          if (typeof document === 'undefined' || !document.hidden) refresh();
        }, POLL_MS);
        return () => {
          alive.current = false;
          clearInterval(timer);
        };
      }, []);

      const onScroll = (e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 700) loadMore();
      };

      // The conversation a picture was drawn in. An archived one stays shut and offers
      // to unarchive it (for a subagent, the session it ran under); a deleted one says so.
      const sessions = props.sessions;
      const go = (id) => {
        if (!sessions.open(id)) return { key: 'sessionGone' };
        box.close();
        return null;
      };
      const openSession =
        sessions && sessions.available()
          ? (item) => {
              const id = item.sessionId;
              const { state, archived } = sessions.state(id);
              if (state === 'gone') return { key: 'sessionGone' };
              if (state !== 'archived') return go(id);
              if (!sessions.canUnarchive()) return { key: 'sessionArchived' };
              return {
                key: 'sessionArchived',
                action: { key: 'unarchiveAndOpen', run: () => sessions.unarchive(archived).then((ok) => (ok ? go(id) : { key: 'unarchiveFailed' })) },
              };
            }
          : undefined;

      const setTab = (next) => {
        setTabState(next);
        try {
          globalThis.localStorage?.setItem(TAB_KEY, next);
        } catch {
          // Remembering the tab is a convenience.
        }
        if (next === 'recipes') void loadRecipes();
      };
      const recipesRef = useRef(recipes);
      recipesRef.current = recipes;
      /** The joined recipe list; resolves to it, or null when the host cannot be reached. */
      const loadRecipes = () =>
        getJson(RECIPES_ROUTE)
          .then((body) => {
            if (!alive.current) return null;
            if (!body?.ok) {
              if (recipesRef.current === null) setRecipesFailed(true);
              return null;
            }
            setRecipesFailed(false);
            setRecipes(body);
            return body;
          })
          .catch(() => {
            if (alive.current && recipesRef.current === null) setRecipesFailed(true);
            return null;
          });
      useEffect(() => {
        if (tab === 'recipes') void loadRecipes();
      }, []);
      /** Show the sheet of the recipe `ref` names. */
      const openRef = (ref) =>
        Promise.resolve(recipesRef.current ?? loadRecipes()).then((data) => {
          const hit = (data?.recipes ?? []).find((r) => r.ref === ref);
          if (hit) setSheet(hit);
          else setToast(t('recipeGone'));
          return hit;
        });
      const afterImport = (body) => {
        setDialog(null);
        void loadRecipes().then((data) => setSheet((data?.recipes ?? []).find((r) => r.ref === body.recipe?.ref) ?? body.recipe));
        setToast(t(body.duplicate ? 'alreadyMine' : 'imported', { title: pickText(body.recipe?.title, lang) }));
      };
      /** Import the recipe a dropped or picked PNG carries. */
      const importFile = (file, onError = (message) => setToast(message)) => {
        if (!file || (file.type && file.type !== 'image/png')) {
          onError(t('importNotPng'));
          return;
        }
        Promise.resolve()
          .then(() => file.arrayBuffer())
          .then((buffer) => postJson(RECIPES_ROUTE, { action: 'import', png: bytesToBase64(buffer) }))
          .then((body) => (body?.ok ? afterImport(body) : onError(t('importFailed', { reason: body?.reason ?? '' }))))
          .catch(() => onError(t('actionFailed')));
      };
      const saveAsRecipe = (item) =>
        postJson(RECIPES_ROUTE, { action: 'save-image', id: item.id })
          .then((body) => {
            if (!body?.ok) throw new Error(body?.reason);
            void loadRecipes();
            setToast({
              text: t(body.duplicate ? 'alreadyMine' : 'savedMine'),
              action: {
                label: t('view'),
                run: () => {
                  setToast('');
                  setTab('recipes');
                  setSheet(body.recipe);
                },
              },
            });
          })
          .catch(() => setToast(t('actionFailed')));
      /** Put a picture made with a community recipe on its works wall: copy it, open the thread. */
      const showOff = (item) =>
        openRef(item.recipe.ref).then((recipe) => {
          const url = issuePage(recipe);
          if (!url) return;
          setSheet(null);
          copyImage(item.url)
            .then(
              () => setToast(t('showOffCopied')),
              () => setToast(t('showOffManual')),
            )
            .finally(() => openExternal(url));
        });
      const galleryActions = (item) => [
        { id: 'remix', run: () => setSheet(pictureRecipe(t, item)) },
        { id: 'makeTemplate', run: () => void startTemplate(t, lang, pictureRecipe(t, item), drafts, setToast) },
        { id: 'saveAsRecipe', run: () => void saveAsRecipe(item) },
        ...(item.mediaType === 'image/png' ? [{ id: 'downloadWithRecipe', run: () => saveUrl(`${item.url}?download=1&recipe=1`, `${item.id}.png`) }] : []),
        ...(isRemote(item.recipe?.ref) ? [{ id: 'showOff', run: () => void showOff(item) }] : []),
      ];

      const remove = (item) => {
        setItems((list) => (list ?? []).filter((i) => i.id !== item.id));
        setTotal((n) => Math.max(0, n - 1));
        if (box.at >= 0) box.close();
        void postJson(DELETE_ROUTE, { id: item.id }).catch(() => {});
      };

      const header = h(
        'div',
        {
          style: {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '16px 24px 12px',
            background: C.base,
            borderBottom: `1px solid ${C.border1}`,
          },
        },
        h('span', { style: { fontSize: 15.5, fontWeight: 640, color: C.primary } }, t('title')),
        About ? h(About, { style: { alignSelf: 'center' } }) : null,
        h(
          'span',
          { role: 'tablist', style: { display: 'inline-flex', gap: 2, padding: 2, borderRadius: 9, background: C.hover, alignSelf: 'center' } },
          [
            ['gallery', t('tabGallery')],
            ['recipes', t('tabRecipes')],
          ].map(([key, label]) =>
            h(
              'button',
              {
                key,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === key,
                'data-dsh-images-tab': key,
                onClick: () => setTab(key),
                style: { font: 'inherit', fontSize: 12.5, fontWeight: tab === key ? 600 : 500, padding: '3px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === key ? C.layer1 : 'transparent', boxShadow: tab === key ? C.lift : 'none', color: tab === key ? C.primary : C.muted },
              },
              label,
            ),
          ),
        ),
        tab === 'gallery'
          ? h('span', { style: { fontSize: SMALL, color: C.faint } }, [total > 0 ? t('count', { n: total }) : null, fmtTotals(totals) ? t('spent', { amount: fmtTotals(totals) }) : null].filter(Boolean).join(' · '))
          : h('span', { style: { fontSize: SMALL, color: C.faint } }, recipes?.recipes ? t('recipeCount', { n: recipes.recipes.length }) : ''),
        h('span', { style: { flex: 1 } }),
        ...(tab === 'gallery'
          ? [h(HeaderButton, { key: 'refresh', onClick: refresh }, t('refresh'))]
          : [
              h(HeaderButton, { key: 'import', onClick: () => setDialog('import'), 'data-dsh-images-import-button': true }, t('importRecipe')),
              h(HeaderButton, { key: 'sources', onClick: () => setDialog('sources'), 'data-dsh-images-sources-button': true }, t('sources')),
            ]),
        h(HeaderButton, { key: 'settings', onClick: () => setSettingsOpen(true), icon: h(GearIcon), 'data-dsh-images-settings-button': true }, t('settings')),
      );

      let body;
      if (tab === 'recipes') body = h(RecipesView, { t, lang, data: recipes, failed: recipesFailed, onOpen: setSheet, onFillCover: (r) => fillCover(t, r, setToast), onImportFile: (file) => importFile(file) });
      else if (failed) body = h('div', { style: { padding: 24, color: C.faint } }, t('unavailable'));
      else if (items === null) body = h('div', { style: { padding: 24, color: C.faint } }, '…');
      else if (items.length === 0) body = h('div', { style: { padding: '48px 24px', color: C.muted, maxWidth: 520, lineHeight: 1.6 } }, t('empty'));
      else {
        body = h(
          'div',
          { 'data-dsh-images-grid': true, style: { padding: '18px 24px 60px', columnWidth: 240, columnGap: 14 } },
          items.map((item) =>
            h(
              'div',
              { key: item.id, style: { breakInside: 'avoid', marginBottom: 14 } },
              h(Tile, {
                t,
                item,
                onOpen: (it) => box.open(items, it),
                onDelete: remove,
                extraActions: galleryActions(item),
                caption: h(
                  'figcaption',
                  { style: { padding: '8px 10px 9px', fontSize: SMALL, lineHeight: 1.45 } },
                  item.recipe?.ref && !String(item.recipe.ref).startsWith('image:')
                    ? h(
                        'button',
                        {
                          type: 'button',
                          'data-dsh-images-tile-recipe': item.recipe.ref,
                          onClick: () => void openRef(item.recipe.ref),
                          style: { display: 'inline-block', maxWidth: '100%', marginBottom: 4, font: 'inherit', fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 6, border: 'none', background: C.layer3, color: C.label, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                        },
                        t('withRecipe', { title: pickText(item.recipe.title, lang) || item.recipe.ref }),
                      )
                    : null,
                  item.prompt
                    ? h('div', { title: item.prompt, style: { color: C.primary, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' } }, item.prompt)
                    : null,
                  h('div', { style: { marginTop: 3, color: C.faint, fontSize: 11.5 } }, metaLine(t, item)),
                ),
              }),
            ),
          ),
          hasMore
            ? h(
                'div',
                { style: { breakInside: 'avoid', textAlign: 'center', padding: 12 } },
                h('button', { type: 'button', onClick: loadMore, disabled: loadingMore, style: { font: 'inherit', fontSize: SMALL, color: C.muted, background: 'transparent', border: `1px solid ${C.border1}`, borderRadius: 9, padding: '6px 14px', cursor: 'pointer' } }, loadingMore ? '…' : t('loadMore')),
              )
            : null,
        );
      }

      return h(
        'div',
        {
          ref: scroller,
          onScroll,
          'data-dsh-images-panel': true,
          style: { position: 'relative', height: '100%', width: '100%', overflowY: 'auto', background: C.base, color: C.primary, fontSize: FONT, boxSizing: 'border-box' },
        },
        header,
        body,
        box.at >= 0 && items ? h(Lightbox, { t, items, index: box.at, onClose: box.close, onStep: box.step, onOpenSession: openSession, sessionTitle: sessions?.title }) : null,
        settingsOpen
          ? h(SettingsDrawer, {
              t,
              onClose: () => setSettingsOpen(false),
              onSaved: (body) => {
                setSettingsOpen(false);
                setToast(t('saved'));
                if (body?.stats?.totals) setTotals(body.stats.totals);
              },
            })
          : null,
        sheet
          ? h(RecipeSheet, {
              key: sheet.ref,
              t,
              lang,
              recipe: sheet,
              drafts,
              onClose: () => setSheet(null),
              onToast: setToast,
              onChanged: (next) => {
                void loadRecipes();
                setSheet(next ?? null);
                if (next && tab !== 'recipes') setTab('recipes');
              },
            })
          : null,
        dialog === 'import' ? h(ImportDrawer, { t, onClose: () => setDialog(null), onImported: afterImport, importFile }) : null,
        dialog === 'sources' ? h(SourcesDrawer, { t, lang, data: recipes, onClose: () => setDialog(null), onData: setRecipes }) : null,
        toast
          ? h(PanelToast, {
              text: typeof toast === 'string' ? toast : toast.text,
              action: typeof toast === 'string' ? undefined : toast.action,
              onDone: () => setToast(''),
              // Over an open drawer, the notice floats above it.
              style: sheet || dialog || settingsOpen ? { position: 'fixed', zIndex: 1600 } : undefined,
            })
          : null,
      );
    }

    function HeaderButton({ onClick, icon, children, ...rest }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          ...rest,
          style: { display: 'inline-flex', alignItems: 'center', gap: 6, font: 'inherit', fontSize: SMALL, color: C.muted, background: C.layer2, border: `1px solid ${C.border1}`, borderRadius: 9, padding: '5px 12px', cursor: 'pointer' },
        },
        icon ?? null,
        children,
      );
    }

    /**
     * A notice that leaves by itself. With `action` ({label, run, busy}) it carries
     * a button, stays longer, and stays while the action runs. White on dark in
     * every theme: the Harness has no elevated-surface token, and the viewer sits
     * on document.body over its own dark backdrop, where a theme's dark label
     * would vanish.
     */
    function PanelToast({ text, onDone, style, action }) {
      const busy = action?.busy === true;
      useEffect(() => {
        if (busy) return undefined;
        const timer = setTimeout(onDone, action ? 8000 : 3200);
        return () => clearTimeout(timer);
      }, [text, busy]);
      return h(
        'div',
        {
          role: 'status',
          'data-dsh-images-toast': true,
          // In the viewer a click on the notice must not close it.
          onClick: (e) => e.stopPropagation(),
          style: {
            position: 'absolute',
            left: '50%',
            bottom: 28,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: 'max-content',
            maxWidth: 'calc(100% - 48px)',
            boxSizing: 'border-box',
            padding: action ? '6px 8px 6px 14px' : '8px 14px',
            borderRadius: 10,
            fontSize: SMALL,
            lineHeight: 1.5,
            background: 'rgba(44,44,48,.96)',
            border: '1px solid rgba(255,255,255,.12)',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.24)',
            zIndex: 20,
            ...style,
          },
        },
        h('span', null, text),
        action
          ? h(
              'button',
              {
                type: 'button',
                disabled: busy,
                'data-dsh-images-toast-action': true,
                onClick: (e) => {
                  e.stopPropagation();
                  if (!busy) action.run();
                },
                style: { flex: 'none', font: 'inherit', fontSize: SMALL, fontWeight: 600, padding: '3px 10px', border: 'none', borderRadius: 7, background: 'rgba(255,255,255,.16)', color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, whiteSpace: 'nowrap' },
              },
              action.label,
            )
          : null,
      );
    }

    // --- the settings drawer ---------------------------------------------------------

    const field = { display: 'flex', flexDirection: 'column', gap: 6 };
    const labelStyle = { fontSize: 12, color: C.muted, fontWeight: 500 };
    const inputStyle = {
      font: 'inherit',
      fontSize: 13,
      color: C.primary,
      background: C.layer1,
      border: `1px solid ${C.border}`,
      borderRadius: 9,
      padding: '8px 11px',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
    };
    const hintStyle = { fontSize: 11.5, color: C.faint, lineHeight: 1.5 };
    const sectionTitle = (text) => h('div', { style: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: C.faint, fontWeight: 600, marginTop: 6 } }, text);

    /**
     * How well `query` matches `text`, loosely: each space-separated term must
     * appear in order, letters may be skipped (`img26` finds `gpt-image-2.6`).
     * A term found whole, or starting a word, scores higher. Returns
     * `{score, hits}` (matched character indexes), or null for no match.
     */
    function fuzzyMatch(query, text) {
      const terms = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const hay = String(text ?? '').toLowerCase();
      if (terms.length === 0) return { score: 0, hits: [] };
      const startsWord = (i) => i === 0 || /[\s/\-_.:]/.test(hay[i - 1]);
      const hits = new Set();
      let score = 0;
      for (const term of terms) {
        const at = hay.indexOf(term);
        if (at >= 0) {
          score += term.length * 3 + (startsWord(at) ? 6 : 0);
          for (let i = 0; i < term.length; i += 1) hits.add(at + i);
          continue;
        }
        // Letters in order; of every place the first letter could anchor, keep the best.
        let best = null;
        for (let start = hay.indexOf(term[0]); start >= 0; start = hay.indexOf(term[0], start + 1)) {
          const at = [start];
          for (const ch of term.slice(1)) {
            const i = hay.indexOf(ch, at[at.length - 1] + 1);
            if (i < 0) break;
            at.push(i);
          }
          if (at.length < term.length) break;
          const s = at.reduce((sum, i, k) => sum + 1 + (k > 0 && i === at[k - 1] + 1 ? 2 : 0) + (startsWord(i) ? 2 : 0), 0) - (at[at.length - 1] - at[0]) / 50;
          if (!best || s > best.s) best = { s, at };
        }
        if (!best) return null;
        score += best.s;
        for (const i of best.at) hits.add(i);
      }
      // Among equals, the shorter id is the likelier one.
      return { score: score - hay.length / 100, hits: [...hits].sort((a, b) => a - b) };
    }

    /** `text` with the characters at `hits` emphasized. */
    function highlighted(text, hits) {
      if (!hits || hits.length === 0) return text;
      const on = new Set(hits);
      const parts = [];
      let run = '';
      let runOn = on.has(0);
      const flush = (i) => {
        if (run === '') return;
        parts.push(runOn ? h('span', { key: i, style: { color: C.primary, fontWeight: 650 } }, run) : run);
        run = '';
      };
      for (let i = 0; i < text.length; i += 1) {
        if (on.has(i) !== runOn) {
          flush(i);
          runOn = on.has(i);
        }
        run += text[i];
      }
      flush(text.length);
      return parts;
    }

    /** The routing prefix of a model id (`sub2api/` of `sub2api/gpt-image-1.5`), or ''. */
    const prefixOf = (id) => (String(id ?? '').includes('/') ? String(id).slice(0, String(id).lastIndexOf('/') + 1) : '');

    const COMBO_LIMIT = 200;

    /**
     * A text field with a searchable list under it. Typing filters every group
     * loosely; any id can still be typed. Groups marked `prefixable` (the price
     * catalog's bare names) take the routing prefix being typed, or the one the
     * field had when the list opened.
     */
    function ModelCombo({ t, value, placeholder, groups, onChange, labelId }) {
      const [open, setOpen] = useState(false);
      const [query, setQuery] = useState(null); // null: just opened, show everything
      const [active, setActive] = useState(-1);
      const [base, setBase] = useState('');
      const inputRef = useRef(null);
      const listRef = useRef(null);

      const q = query ?? '';
      const seen = new Set();
      const sections = [];
      let total = 0;
      for (const group of groups) {
        const prefix = group.prefixable ? (q.includes('/') ? prefixOf(q) : prefixOf(base)) : '';
        const term = group.prefixable && q.includes('/') ? q.slice(prefix.length) : q;
        const rows = [];
        for (const item of group.items) {
          const id = `${prefix}${item.id}`;
          if (seen.has(id)) continue;
          const m = fuzzyMatch(term, item.id);
          if (!m) continue;
          seen.add(id);
          rows.push({ ...item, id, hits: m.hits.map((i) => i + prefix.length), score: m.score });
        }
        if (term !== '') rows.sort((a, b) => b.score - a.score);
        if (rows.length === 0) continue;
        total += rows.length;
        sections.push({ ...group, prefix, rows });
      }
      // One flat list for the arrow keys, capped so a huge listing stays quick.
      const flat = [];
      for (const section of sections) {
        section.rows = section.rows.slice(0, Math.max(0, COMBO_LIMIT - flat.length));
        flat.push(...section.rows);
      }
      const hidden = total - flat.length;

      useEffect(() => {
        if (!open || active < 0) return;
        const node = listRef.current?.querySelector?.(`[data-index="${active}"]`);
        node?.scrollIntoView?.({ block: 'nearest' });
      }, [open, active]);

      const show = () => {
        setOpen(true);
        setQuery(null);
        setBase(value ?? '');
        setActive(-1);
      };
      const pick = (id) => {
        onChange(id);
        setOpen(false);
        setQuery(null);
      };
      const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!open) show();
          else setActive((a) => Math.min(flat.length - 1, a + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive((a) => Math.max(0, a - 1));
        } else if (e.key === 'Enter') {
          if (open && flat[active]) {
            e.preventDefault();
            pick(flat[active].id);
          }
        } else if (e.key === 'Escape') {
          if (open) {
            e.preventDefault();
            e.stopPropagation?.();
            setOpen(false);
          }
        } else if (e.key === 'Tab') setOpen(false);
      };
      const listId = 'dsh-images-model-list';
      const hasAny = groups.some((g) => g.items.length > 0);
      const showList = open && (hasAny || q !== '');

      let index = -1;
      return h(
        'div',
        { style: { position: 'relative' } },
        h('input', {
          ref: inputRef,
          role: 'combobox',
          'aria-expanded': showList,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          'aria-labelledby': labelId,
          'aria-activedescendant': showList && active >= 0 ? `${listId}-${active}` : undefined,
          value: value ?? '',
          placeholder,
          onFocus: show,
          onClick: () => !open && show(),
          onBlur: () => setOpen(false),
          onChange: (e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
            setOpen(true);
            setActive(e.target.value === '' ? -1 : 0);
          },
          onKeyDown,
          style: { ...inputStyle, paddingRight: 34 },
          spellCheck: false,
          autoComplete: 'off',
          'data-dsh-images-field': 'model',
        }),
        h(
          'button',
          {
            type: 'button',
            tabIndex: -1,
            'aria-label': t('comboToggle'),
            onMouseDown: (e) => {
              e.preventDefault();
              if (showList) setOpen(false);
              else {
                show();
                inputRef.current?.focus?.();
              }
            },
            style: { position: 'absolute', right: 4, top: 4, bottom: 4, width: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'transparent', color: C.faint, cursor: 'pointer' },
          },
          h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true, style: { transform: showList ? 'rotate(180deg)' : 'none', transition: 'transform .15s' } }, h('path', { d: 'M2.5 4.5 6 8l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' })),
        ),
        showList
          ? h(
              'div',
              {
                ref: listRef,
                id: listId,
                role: 'listbox',
                'data-dsh-images-model-list': true,
                onMouseDown: (e) => e.preventDefault(),
                style: { position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 5, maxHeight: 300, overflowY: 'auto', padding: 4, background: C.base, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.18)' },
              },
              flat.length === 0 ? h('div', { style: { padding: '8px 10px', fontSize: 12, color: C.faint } }, t('comboNoMatch')) : null,
              sections.map((section) =>
                h(
                  'div',
                  { key: section.key, role: 'group', 'aria-label': section.label },
                  h('div', { style: { padding: '6px 10px 3px', fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.faint, fontWeight: 600 } }, section.prefix ? `${section.label} · ${section.prefix}` : section.label),
                  section.rows.map((row) => {
                    index += 1;
                    const i = index;
                    return h(
                      'div',
                      {
                        key: row.id,
                        id: `${listId}-${i}`,
                        role: 'option',
                        'aria-selected': i === active,
                        'data-index': i,
                        'data-dsh-images-model-option': row.id,
                        onMouseDown: (e) => {
                          e.preventDefault();
                          pick(row.id);
                        },
                        onMouseEnter: () => setActive(i),
                        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', color: C.muted, background: i === active ? C.hover : 'transparent', fontWeight: row.id === value ? 600 : 400 },
                      },
                      h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, highlighted(row.id, row.hits)),
                      row.tag ? h('span', { style: { flex: 'none', fontSize: 10.5, padding: '1px 6px', borderRadius: 999, border: `1px solid ${C.border1}`, color: C.faint } }, row.tag) : null,
                    );
                  }),
                ),
              ),
              hidden > 0 ? h('div', { style: { padding: '6px 10px', fontSize: 11.5, color: C.faint } }, t('comboMore', { n: hidden })) : null,
            )
          : null,
      );
    }

    function Segmented({ value, options, onChange }) {
      return h(
        'div',
        { role: 'radiogroup', style: { display: 'inline-flex', padding: 3, gap: 2, background: C.layer2, borderRadius: 9, border: `1px solid ${C.border1}` } },
        options.map((o) =>
          h(
            'button',
            {
              key: o.value,
              type: 'button',
              role: 'radio',
              'aria-checked': o.value === value,
              onClick: () => onChange(o.value),
              style: {
                font: 'inherit',
                fontSize: 12,
                padding: '4px 10px',
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                background: o.value === value ? C.layer1 : 'transparent',
                color: o.value === value ? C.primary : C.muted,
                boxShadow: o.value === value ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                fontWeight: o.value === value ? 600 : 400,
              },
            },
            o.label,
          ),
        ),
      );
    }

    function SettingsDrawer({ t, onClose, onSaved }) {
      const [info, setInfo] = useState(null);
      const [draft, setDraft] = useState(null);
      const [apiKey, setApiKey] = useState('');
      const [clearKey, setClearKey] = useState(false);
      const [models, setModels] = useState(null);
      const [probe, setProbe] = useState(null); // {state:'busy'|'ok'|'bad', text}
      const [preview, setPreview] = useState(null);
      const [catalog, setCatalog] = useState(null); // {status, names}
      const [catalogTick, setCatalogTick] = useState(0);
      const [saving, setSaving] = useState(false);
      const alive = useRef(true);
      const previewTimer = useRef(null);

      useEffect(() => {
        alive.current = true;
        getJson(SETTINGS_ROUTE)
          .then((body) => {
            if (!alive.current || !body) return;
            setInfo(body);
            setDraft({ ...body.values });
          })
          .catch(() => {});
        // The price catalog's image models, for the picker; downloaded on first use.
        getJson(CATALOG_ROUTE)
          .then((body) => alive.current && body?.status && setCatalog(body))
          .catch(() => {});
        return () => {
          alive.current = false;
        };
      }, []);

      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const key = (e) => {
          // An open model list takes the Escape for itself.
          if (e.key === 'Escape' && e.target?.getAttribute?.('aria-expanded') !== 'true') onClose();
        };
        document.addEventListener('keydown', key, true);
        return () => document.removeEventListener('keydown', key, true);
      }, []);

      // How the typed model would be billed; asked a moment after typing stops.
      useEffect(() => {
        if (!draft) return undefined;
        if (previewTimer.current) clearTimeout(previewTimer.current);
        const model = draft.model || info?.defaults?.model || '';
        if (!model) {
          setPreview(null);
          return undefined;
        }
        previewTimer.current = setTimeout(() => {
          getJson(`${SETTINGS_ROUTE}?model=${encodeURIComponent(model)}&size=${encodeURIComponent(draft.size || '')}&quality=${encodeURIComponent(draft.quality || '')}`)
            .then((body) => alive.current && setPreview(body))
            .catch(() => {});
        }, 250);
        return () => clearTimeout(previewTimer.current);
      }, [draft?.model, draft?.size, draft?.quality, catalogTick]);

      if (!info || !draft) {
        return h(DrawerFrame, { t, onClose }, h('div', { style: { color: C.faint } }, '…'));
      }

      const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
      const providerOptions = [
        { value: '', label: info.sessionProvider ? t('providerSession', { name: info.sessionProvider }) : t('providerSessionNone') },
        ...info.providers.filter((p) => p.id !== '').map((p) => ({ value: p.id, label: p.name === p.id ? p.id : `${p.name} (${p.id})` })),
        { value: 'custom', label: t('providerCustom') },
      ];
      const pickedProvider = info.providers.find((p) => p.id === (draft.provider || info.sessionProvider));
      const baseURLPlaceholder = draft.provider === 'custom' ? 'https://api.openai.com/v1' : pickedProvider?.baseURL || info.effective.baseURL || 'https://…/v1';
      const keyPlaceholder = info.storedKey
        ? t('keyStored', { hint: info.storedKey })
        : info.effective.keySource === 'provider' || info.effective.keySource === 'env'
          ? t('keyFromProvider', { hint: info.effective.keyHint })
          : t('keyNone');

      const runProbe = () => {
        setProbe({ state: 'busy', text: t('probing') });
        postJson(MODELS_ROUTE, { provider: draft.provider, baseURL: draft.baseURL, ...(apiKey ? { apiKey } : {}) })
          .then((body) => {
            if (!alive.current) return;
            if (!body || body.ok !== true) {
              setProbe({ state: 'bad', text: body?.reason ? t('probeFailed', { reason: body.reason }) : t('probeFailed', { reason: '?' }) });
              return;
            }
            setModels(body.models);
            const imageCount = body.models.filter((m) => m.isImage).length;
            setProbe({ state: 'ok', text: imageCount > 0 ? t('probeOk', { n: body.models.length, images: imageCount }) : t('probeOkNoImages', { n: body.models.length }) });
          })
          .catch(() => alive.current && setProbe({ state: 'bad', text: t('probeFailed', { reason: 'network' }) }));
      };

      const refreshCatalog = () => {
        setCatalog((c) => (c ? { ...c, status: { ...c.status, loading: true, error: '' } } : { status: { ...(info.catalog ?? {}), loading: true, error: '' }, names: [] }));
        postJson(CATALOG_ROUTE, { refresh: true })
          .then((body) => {
            if (!alive.current || !body?.status) return;
            setCatalog(body);
            setCatalogTick((n) => n + 1);
          })
          .catch(() => {});
      };

      const save = () => {
        setSaving(true);
        const body = { ...draft };
        if (clearKey) body.apiKey = null;
        else if (apiKey.trim() !== '') body.apiKey = apiKey.trim();
        postJson(SETTINGS_ROUTE, body)
          .then((res) => {
            if (!alive.current) return;
            setSaving(false);
            if (res?.ok) onSaved(res);
          })
          .catch(() => alive.current && setSaving(false));
      };

      const catalogName = catalog?.status?.name || info.catalog?.name || 'LiteLLM';
      const previewText = (() => {
        if (!preview) return '';
        if (preview.source === 'provider') return t('priceProvider', { price: fmtMoney(preview.perImage.amount, preview.perImage.currency) });
        if (preview.source === 'list') {
          const samples = (preview.samples ?? []).map((r) => `${r.size.replace('x', '×')} ${fmtMoney(r.price.amount, r.price.currency)}`).join(' · ');
          return t('priceList', { family: preview.family, samples, date: preview.priceListDate });
        }
        if (preview.source === 'catalog' && preview.catalog) {
          const c = preview.catalog;
          const name = c.approximate ? t('catalogNear', { name: c.name }) : c.name;
          const flat = c.perImage ? fmtMoney(c.perImage.amount, c.perImage.currency) : '';
          if (!c.tokens) return t('priceCatalogFlat', { catalog: catalogName, name, price: flat });
          const head = t('priceCatalogTokens', { catalog: catalogName, name, textIn: fmtMoney(c.tokens.textIn, 'USD'), imageOut: fmtMoney(c.tokens.imageOut, 'USD') });
          const tail = flat
            ? t('priceNoUsageFlat', { price: flat })
            : preview.manual
              ? t('priceNoUsageManual', { price: fmtMoney(preview.manual.amount, preview.manual.currency) })
              : t('priceNoUsageBlank');
          return `${head} ${tail}`;
        }
        if (preview.source === 'manual') return t('priceManual', { price: fmtMoney(preview.perImage.amount, preview.perImage.currency) });
        return preview.catalogError ? t('priceUnknownOffline', { catalog: catalogName }) : t('priceUnknown', { catalog: catalogName });
      })();

      // What the model picker offers: ids used before, the provider's listing, the catalog.
      const usedIds = [...new Set([info.values.model, info.defaults.model, ...Object.entries(info.stats?.byModel ?? {}).sort((a, b) => b[1].count - a[1].count).map(([id]) => id)])].filter((id) => typeof id === 'string' && id !== '');
      const pickerGroups = [
        { key: 'used', label: t('groupUsed'), items: usedIds.map((id) => ({ id })) },
        { key: 'provider', label: t('groupProvider'), items: (models ?? []).map((m) => ({ id: m.id, tag: m.isImage ? t('tagImage') : '' })) },
        { key: 'catalog', label: t('groupCatalog', { catalog: catalogName }), prefixable: true, items: (catalog?.names ?? []).map((id) => ({ id, tag: t('tagImage') })) },
      ];
      const catalogStatus = catalog?.status ?? info.catalog;
      const catalogLine = (() => {
        if (!catalogStatus || catalogStatus.enabled === false) return '';
        if (catalogStatus.loading) return t('catalogLoading', { catalog: catalogName });
        if (catalogStatus.count > 0) return t('catalogStatus', { catalog: catalogName, n: catalogStatus.count, date: new Date(catalogStatus.fetchedAt).toISOString().slice(0, 10) });
        if (catalogStatus.error) return t('catalogFailed', { catalog: catalogName, reason: catalogStatus.error });
        return t('catalogNotYet', { catalog: catalogName });
      })();

      const stats = info.stats ?? { total: 0, totals: {}, byModel: {} };
      const modelRows = Object.entries(stats.byModel ?? {}).sort((a, b) => b[1].count - a[1].count);

      return h(
        DrawerFrame,
        {
          t,
          onClose,
          footer: h(
            'div',
            { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
            h(DrawerButton, { onClick: onClose }, t('cancel')),
            h(DrawerButton, { onClick: save, primary: true, disabled: saving, 'data-dsh-images-save': true }, saving ? '…' : t('save')),
          ),
        },
        info.problem ? h('div', { style: { fontSize: 12.5, color: C.error, background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #f25a5a) 10%, transparent)', border: `1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #f25a5a) 30%, transparent)`, borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 } }, info.problem) : null,

        sectionTitle(t('secProvider')),
        h(
          'label',
          { style: field },
          h('span', { style: labelStyle }, t('provider')),
          h(
            'select',
            { value: draft.provider ?? '', onChange: (e) => set({ provider: e.target.value, baseURL: e.target.value === 'custom' ? draft.baseURL : '' }), style: { ...inputStyle, appearance: 'auto' }, 'data-dsh-images-field': 'provider' },
            providerOptions.map((o) => h('option', { key: o.value, value: o.value }, o.label)),
          ),
        ),
        h(
          'label',
          { style: field },
          h('span', { style: labelStyle }, t('baseURL')),
          h('input', { type: 'url', value: draft.baseURL ?? '', placeholder: baseURLPlaceholder, onChange: (e) => set({ baseURL: e.target.value }), style: inputStyle, spellCheck: false, 'data-dsh-images-field': 'baseURL' }),
          draft.provider !== 'custom' ? h('span', { style: hintStyle }, t('baseURLHint')) : null,
        ),
        h(
          'label',
          { style: field },
          h('span', { style: { ...labelStyle, display: 'flex', justifyContent: 'space-between' } }, t('apiKey'), info.storedKey && !clearKey ? h('button', { type: 'button', onClick: () => setClearKey(true), style: { font: 'inherit', fontSize: 11.5, color: C.error, background: 'none', border: 'none', padding: 0, cursor: 'pointer' } }, t('clearKey')) : null),
          h('input', { type: 'password', value: apiKey, placeholder: clearKey ? t('keyWillClear') : keyPlaceholder, onChange: (e) => { setApiKey(e.target.value); if (e.target.value) setClearKey(false); }, style: inputStyle, autoComplete: 'off', spellCheck: false, 'data-dsh-images-field': 'apiKey' }),
          h('span', { style: hintStyle }, t('apiKeyHint')),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h(DrawerButton, { onClick: runProbe, disabled: probe?.state === 'busy', 'data-dsh-images-probe': true }, t('probe')),
          probe ? h('span', { style: { fontSize: 12, color: probe.state === 'bad' ? C.error : probe.state === 'ok' ? 'var(--dsw-alias-state-success-primary, #22c55e)' : C.faint } }, probe.text) : null,
        ),

        sectionTitle(t('secModel')),
        h(
          'div',
          { style: field },
          h('span', { id: 'dsh-images-model-label', style: labelStyle }, t('model')),
          h(ModelCombo, { t, value: draft.model ?? '', placeholder: info.defaults.model || 'gpt-image-1.5', groups: pickerGroups, onChange: (v) => set({ model: v }), labelId: 'dsh-images-model-label' }),
          h('span', { style: { ...hintStyle, color: preview?.source === 'unknown' ? 'var(--dsw-alias-state-warn-primary, #f59e0b)' : C.faint } }, previewText || (models ? t('modelHintListed') : t('modelHint'))),
          preview && preview.gif === false ? h('span', { 'data-dsh-images-gif-hint': true, style: { ...hintStyle, color: WARN } }, t('gifModelHint')) : null,
        ),
        models && models.some((m) => m.isImage)
          ? h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
              models.filter((m) => m.isImage).slice(0, 12).map((m) =>
                h('button', { key: m.id, type: 'button', onClick: () => set({ model: m.id }), style: { font: 'inherit', fontSize: 11.5, padding: '3px 9px', borderRadius: 999, border: `1px solid ${draft.model === m.id ? C.label : C.border}`, color: draft.model === m.id ? C.label : C.muted, background: 'transparent', cursor: 'pointer' } }, m.id),
              ),
            )
          : null,
        h(
          'div',
          { style: { display: 'flex', gap: 18, flexWrap: 'wrap' } },
          h('div', { style: field }, h('span', { style: labelStyle }, t('size')), h(Segmented, { value: draft.size || 'auto', options: [...SIZES.map((v) => ({ value: v, label: v.replace('x', '×') })), { value: 'auto', label: t('auto') }], onChange: (v) => set({ size: v }) })),
          h('div', { style: field }, h('span', { style: labelStyle }, t('quality')), h(Segmented, { value: draft.quality || '', options: [{ value: '', label: t('default') }, ...QUALITIES.map((v) => ({ value: v, label: v }))], onChange: (v) => set({ quality: v }) })),
        ),

        sectionTitle(t('secBilling')),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 10, alignItems: 'end' } },
          h('label', { style: field }, h('span', { style: labelStyle }, t('pricePerImage')), h('input', { type: 'number', min: 0, step: 0.001, value: draft.pricePerImage || '', placeholder: '0', onChange: (e) => set({ pricePerImage: e.target.value === '' ? '' : Number(e.target.value) }), style: inputStyle, 'data-dsh-images-field': 'pricePerImage' })),
          h('label', { style: field }, h('span', { style: labelStyle }, t('currency')), h('select', { value: draft.currency || 'USD', onChange: (e) => set({ currency: e.target.value }), style: { ...inputStyle, appearance: 'auto' } }, ['USD', 'CNY', 'EUR'].map((c) => h('option', { key: c, value: c }, c)))),
        ),
        h('span', { style: hintStyle }, t('pricePerImageHint', { date: info.priceListDate })),
        catalogLine
          ? h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
              h('span', { style: { ...hintStyle, color: catalogStatus?.error && !catalogStatus?.count ? C.error : C.faint }, 'data-dsh-images-catalog': true }, catalogLine),
              catalogStatus?.loading
                ? null
                : h('button', { type: 'button', onClick: refreshCatalog, 'data-dsh-images-catalog-refresh': true, style: { font: 'inherit', fontSize: 11.5, color: C.label, background: 'none', border: 'none', padding: 0, cursor: 'pointer' } }, catalogStatus?.count > 0 ? t('catalogRefresh') : t('catalogRetry')),
            )
          : null,

        stats.total > 0
          ? h(
              'div',
              { style: { marginTop: 4, padding: '10px 12px', borderRadius: 10, background: C.layer2, border: `1px solid ${C.border1}`, display: 'flex', flexDirection: 'column', gap: 6 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.primary, fontWeight: 600 } }, h('span', null, t('statsTotal', { n: stats.total })), h('span', null, fmtTotals(stats.totals) ? `≈ ${fmtTotals(stats.totals)}` : t('statsNoCost'))),
              modelRows.map(([model, row]) =>
                h('div', { key: model, style: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: C.muted } }, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, model), h('span', { style: { flex: 'none' } }, `${row.count} · ${fmtTotals(row.totals) ? `≈ ${fmtTotals(row.totals)}` : '—'}`)),
              ),
            )
          : null,
      );
    }

    function DrawerButton({ onClick, children, primary = false, disabled = false, ...rest }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          disabled,
          ...rest,
          style: {
            font: 'inherit',
            fontSize: 13,
            fontWeight: primary ? 600 : 500,
            padding: '7px 14px',
            borderRadius: 9,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            border: primary ? 'none' : `1px solid ${C.border}`,
            background: primary ? C.label : 'transparent',
            color: primary ? 'var(--dsw-alias-label-primary-foreground, #fff)' : C.primary,
          },
        },
        children,
      );
    }

    /** The drawer's chrome: a dimmed panel behind, a sheet sliding in from the right. */
    function DrawerFrame({ t, onClose, footer, children, title, width = 420 }) {
      const node = h(
        'div',
        { 'data-dsh-images-drawer': true, style: { position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', justifyContent: 'flex-end' } },
        h('style', null, '@keyframes dsh-images-slide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@keyframes dsh-images-fade{from{opacity:0}to{opacity:1}}'),
        h('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,.28)', animation: 'dsh-images-fade .18s ease-out' } }),
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': true,
            'aria-label': title ?? t('settingsTitle'),
            style: {
              position: 'relative',
              width: `min(${width}px, 100vw)`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: C.base,
              borderLeft: `1px solid ${C.border1}`,
              boxShadow: '-12px 0 40px rgba(0,0,0,.18)',
              animation: 'dsh-images-slide .22s cubic-bezier(.2,.8,.2,1)',
              color: C.primary,
              fontSize: FONT,
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 12px', borderBottom: `1px solid ${C.border1}` } },
            h(ImagesGlyph, { size: 16, active: true }),
            h('span', { style: { fontSize: 15, fontWeight: 640, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title ?? t('settingsTitle')),
            h('span', { style: { flex: 1 } }),
            h('button', { type: 'button', 'aria-label': t('close'), onClick: onClose, style: { display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer' } }, h(CloseIcon, { size: 16 })),
          ),
          h('div', { style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 } }, children),
          footer ? h('div', { style: { padding: '12px 20px 16px', borderTop: `1px solid ${C.border1}`, background: C.base } }, footer) : null,
        ),
      );
      return ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined' ? ReactDOM.createPortal(node, document.body) : node;
    }

    // --- recipes ---------------------------------------------------------------------
    //
    // A recipe (玩法) is a tested prompt template with blanks. The Recipes tab lists
    // the built-in ones, the user's own and the community's; opening one shows a
    // sheet to fill its blanks and start a conversation with it, or to pass it on.

    const CATEGORY_ORDER = ['photo', 'handdrawn', 'editorial', 'infographic', '3d', 'sticker', 'illustration', 'product', 'comic'];
    /** A placeholder cover per category: gradient from, to, and the ink on it. */
    const CATEGORY_TINT = {
      photo: ['#ffb88c', '#de6262', '#ffffff'],
      handdrawn: ['#f6ead0', '#dcc39a', '#3b2f20'],
      editorial: ['#2b2d31', '#5b6470', '#ffffff'],
      infographic: ['#a1c4fd', '#c2e9fb', '#16324f'],
      '3d': ['#c471f5', '#fa71cd', '#ffffff'],
      sticker: ['#f6d365', '#fda085', '#4a2a10'],
      illustration: ['#84fab0', '#8fd3f4', '#103a33'],
      product: ['#e0c3fc', '#8ec5fc', '#1f2a4a'],
      comic: ['#ffecd2', '#fcb69f', '#4a2a1a'],
    };
    const tintOf = (category) => CATEGORY_TINT[category] ?? CATEGORY_TINT.illustration;
    const COMMUNITY_HOME = 'https://github.com/kadaliao/dsh-images-recipes';
    const TAB_KEY = 'dsh-images:tab';
    const SLOT_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,31})\s*\}\}/g;

    /** The text for `lang` of a `{zh, en}` pair, else the other one. */
    function pickText(text, lang) {
      if (typeof text === 'string') return text;
      if (!text || typeof text !== 'object') return '';
      const want = String(lang ?? '').startsWith('zh') ? 'zh' : 'en';
      return text[want] ?? text[want === 'zh' ? 'en' : 'zh'] ?? '';
    }
    /**
     * Width over height of a recipe's cover: the picture's own (as the listing gives it, or as
     * it loaded), else the shape of the recipe's size.
     */
    function coverRatio(recipe, loaded) {
      const w = loaded?.width || recipe.coverWidth;
      const ht = loaded?.height || recipe.coverHeight;
      if (recipe.coverUrl && w > 0 && ht > 0) return w / ht;
      const size = recipe.params?.size;
      return size === '1536x1024' ? 3 / 2 : size === '1024x1536' ? 2 / 3 : 1;
    }
    /** A card shows a cover in its own shape, from 1:2 tall to 3:1 wide; past that it is cropped. */
    const cardAspect = (ratio) => String(Math.round(Math.min(3, Math.max(1 / 2, ratio)) * 10_000) / 10_000);
    /** `github:ana` as `@ana`; any other author as written. */
    const authorName = (author) => String(author ?? '').replace(/^github:/, '@');
    const isRemote = (ref) => typeof ref === 'string' && ref !== '' && !/^(builtin|mine|image):/.test(ref);
    /** The issue a community recipe lives in (its votes and works wall), on whichever server its source is. */
    const issuePage = (recipe) => recipe?.issueUrl ?? (recipe?.issue && recipe.repo ? `https://github.com/${recipe.repo}/issues/${recipe.issue}` : null);
    /**
     * A recipe the user shared went up without its cover: put the cover on the
     * clipboard (or download it, when the clipboard says no), then open the issue
     * to paste it into. The copy comes first, while the click still counts.
     */
    function fillCover(t, recipe, onToast) {
      const url = issuePage(recipe);
      if (!url || !recipe.fillCoverUrl) return;
      copyImage(recipe.fillCoverUrl)
        .then(
          () => true,
          () => false,
        )
        .then((ok) => {
          if (!ok) saveUrl(recipe.fillCoverUrl, `${recipe.id || 'recipe'}-cover`);
          openExternal(url);
          onToast(t(ok ? 'fillCoverCopied' : 'fillCoverSaved'));
        });
    }
    const slotNames = (prompt) => {
      const names = [];
      for (const m of String(prompt ?? '').matchAll(SLOT_RE)) if (!names.includes(m[1])) names.push(m[1]);
      return names;
    };

    function openExternal(url) {
      try {
        if (typeof window !== 'undefined' && typeof window.open === 'function') window.open(url, '_blank', 'noopener');
        return true;
      } catch {
        return false;
      }
    }
    function bytesToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function base64ToBlob(b64, type) {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return new Blob([out], { type });
    }
    function saveBlob(blob, name) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch {
        // Nothing to do without a document.
      }
    }
    /** Save a URL the page can reach through the browser's download flow. */
    function saveUrl(url, name) {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        // Nothing to do without a document.
      }
    }
    function loadImageEl(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image'));
        img.src = src;
      });
    }
    /**
     * Put a picture on the clipboard as a PNG (a GIF goes as its first frame). The
     * write is asked for at once, with the picture still to come, so it counts as
     * part of the click that asked for it; a browser that wants the picture in hand
     * gets it after.
     */
    async function copyImage(url) {
      const png = (async () => {
        const res = await fetch(url, { credentials: 'same-origin' });
        const blob = await res.blob();
        if (blob.type === 'image/png') return blob;
        const img = await loadImageEl(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
      })();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      } catch {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await png })]);
      }
    }

    /** Lay `text` out in at most `maxLines` lines of `width`, ending in … when cut; returns the next y. */
    function wrapText(g, text, x, y, width, lineHeight, maxLines) {
      const tokens = String(text ?? '').match(/[⺀-鿿＀-￯]|[^\s⺀-鿿＀-￯]+\s*|\s+/g) ?? [];
      const lines = [];
      let line = '';
      for (const token of tokens) {
        const next = line + token;
        if (g.measureText(next.trimEnd()).width > width && line !== '') {
          lines.push(line.trimEnd());
          line = token.trimStart();
        } else line = next;
      }
      if (line.trim() !== '') lines.push(line.trimEnd());
      const shown = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        let last = shown[maxLines - 1];
        while (last.length > 1 && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
        shown[maxLines - 1] = `${last}…`;
      }
      for (const l of shown) {
        g.fillText(l, x, y);
        y += lineHeight;
      }
      return y;
    }

    /** The recipe's share card: its cover, title and summary, and how to use it. A PNG blob. */
    async function renderCard(t, lang, recipe) {
      const W = 1080;
      const H = 1440;
      const M = 64;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const g = canvas.getContext('2d');
      const font = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
      g.fillStyle = '#f6f4ef';
      g.fillRect(0, 0, W, H);
      const box = { x: M, y: M, w: W - 2 * M, h: 940 };
      g.save();
      g.beginPath();
      if (typeof g.roundRect === 'function') g.roundRect(box.x, box.y, box.w, box.h, 28);
      else g.rect(box.x, box.y, box.w, box.h);
      g.clip();
      let drawn = false;
      if (recipe.coverUrl) {
        try {
          const img = await loadImageEl(recipe.coverUrl);
          const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const hh = img.naturalHeight * scale;
          g.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - hh) / 2, w, hh);
          drawn = true;
        } catch {
          drawn = false;
        }
      }
      if (!drawn) {
        const [from, to, ink] = tintOf(recipe.category);
        const grad = g.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
        grad.addColorStop(0, from);
        grad.addColorStop(1, to);
        g.fillStyle = grad;
        g.fillRect(box.x, box.y, box.w, box.h);
        g.fillStyle = ink;
        g.font = `700 76px ${font}`;
        wrapText(g, pickText(recipe.title, lang), box.x + 56, box.y + box.h - 200, box.w - 112, 92, 2);
      }
      g.restore();
      let y = box.y + box.h + 96;
      g.fillStyle = '#1d1d1f';
      g.font = `700 58px ${font}`;
      y = wrapText(g, pickText(recipe.title, lang), M, y, W - 2 * M, 72, 2);
      g.fillStyle = '#55555a';
      g.font = `400 34px ${font}`;
      wrapText(g, pickText(recipe.summary, lang), M, y + 6, W - 2 * M, 48, 2);
      g.fillStyle = '#8a8a90';
      g.font = `500 26px ${font}`;
      const credit = recipe.source?.repo ? t('cardCredit', { repo: recipe.source.repo }) : recipe.author ? t('cardBy', { author: authorName(recipe.author) }) : '';
      if (credit) g.fillText(credit, M, H - 112);
      g.fillText(t('cardFooter'), M, H - 66);
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
    }

    /** The message a recipe starts a conversation with: which recipe, the blanks filled, the extra wish. */
    function draftMessage(t, lang, recipe, values, extra) {
      const lines = [recipe.origin === 'image' ? t('draftRemix', { ref: recipe.ref }) : t('draftUse', { title: pickText(recipe.title, lang), ref: recipe.ref })];
      for (const slot of recipe.slots ?? []) {
        const v = String(values?.[slot.name] ?? '').trim();
        if (v !== '') lines.push(`${pickText(slot.label, lang)}${t('colon')}${v}`);
      }
      if (String(extra ?? '').trim() !== '') lines.push(t(recipe.origin === 'image' ? 'draftChange' : 'draftExtra', { text: String(extra).trim() }));
      if ((recipe.inputs ?? []).length > 0) lines.push(t('draftAttach', { list: recipe.inputs.map((i) => pickText(i.label, lang)).join(t('listSep')) }));
      return lines.join('\n');
    }

    /**
     * The message that asks the model to make a template of a picture, or of a recipe of the
     * user's without blanks: it picks the parts worth changing and makes them blanks.
     */
    function templateMessage(t, lang, recipe) {
      const blank = '{{name}}';
      return recipe.origin === 'image' ? t('draftTemplatePicture', { ref: recipe.ref, id: recipe.image, blank }) : t('draftTemplateMine', { title: pickText(recipe.title, lang), ref: recipe.ref, blank });
    }
    /** Start a conversation that makes a template; without one to start, the message is copied. Resolves whether it started. */
    function startTemplate(t, lang, recipe, drafts, onToast) {
      const text = templateMessage(t, lang, recipe);
      return Promise.resolve(drafts?.start?.(text))
        .catch(() => false)
        .then((started) => {
          if (started) onToast(t('templateStarted'));
          else {
            copyText(text);
            onToast(t('draftCopied'));
          }
          return Boolean(started);
        });
    }

    /** A gallery picture as the recipe it stands for, for the sheet: "make one like this". */
    function pictureRecipe(t, item) {
      const inputs = Math.max(0, Number(item.inputs) || 0);
      return {
        ref: `image:${item.id}`,
        origin: 'image',
        id: `image-${item.id}`,
        title: { en: t('remixTitle'), zh: t('remixTitle') },
        summary: {},
        category: item.animation ? 'sticker' : inputs > 0 ? 'photo' : 'illustration',
        tags: [],
        inputs: Array.from({ length: inputs }, (_, i) => ({ name: `image${i + 1}`, label: { en: t('inputN', { n: i + 1 }), zh: t('inputN', { n: i + 1 }) } })),
        slots: [],
        prompt: item.prompt ?? '',
        params: { ...(item.size ? { size: item.size } : {}), ...(item.animation?.frames ? { frames: item.animation.frames } : {}) },
        coverUrl: item.url,
        image: item.id,
        mediaType: item.mediaType,
      };
    }

    function Chip({ active, onClick, children, ...rest }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          ...rest,
          style: {
            flex: 'none',
            font: 'inherit',
            fontSize: 12,
            padding: '4px 11px',
            borderRadius: 999,
            cursor: 'pointer',
            border: `1px solid ${active ? 'transparent' : C.border1}`,
            background: active ? C.hover : 'transparent',
            color: active ? C.accent : C.muted,
            whiteSpace: 'nowrap',
          },
        },
        children,
      );
    }

    function Badge({ children, tone = 'dark' }) {
      return h(
        'span',
        { style: { fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: tone === 'dark' ? 'rgba(0,0,0,.55)' : C.layer3, color: tone === 'dark' ? '#fff' : C.muted, backdropFilter: 'blur(6px)', lineHeight: 1.5, whiteSpace: 'nowrap' } },
        children,
      );
    }

    /** A recipe's cover: its picture, or a gradient of its category with its title. */
    function RecipeCover({ recipe, lang, big = false, fit = 'cover', onSize }) {
      const [broken, setBroken] = useState(false);
      const [from, to, ink] = tintOf(recipe.category);
      if (recipe.coverUrl && !broken) {
        return h('img', {
          src: recipe.coverUrl,
          alt: pickText(recipe.title, lang),
          loading: 'lazy',
          decoding: 'async',
          draggable: false,
          onError: () => setBroken(true),
          onLoad: onSize ? (e) => onSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }) : undefined,
          style: { display: 'block', width: '100%', height: '100%', objectFit: fit, background: C.layer2 },
        });
      }
      return h(
        'div',
        {
          'data-dsh-images-cover-placeholder': true,
          style: { width: '100%', height: '100%', minHeight: big ? 200 : undefined, background: `linear-gradient(135deg, ${from}, ${to})`, color: ink, display: 'flex', alignItems: 'flex-end', padding: big ? 22 : 14, boxSizing: 'border-box', fontWeight: 700, fontSize: big ? 24 : 17, lineHeight: 1.3 },
        },
        pickText(recipe.title, lang),
      );
    }

    function RecipeCard({ t, lang, recipe, onOpen, onFillCover }) {
      // A cover the listing could not measure yet (a community one not downloaded) takes its
      // shape once it loads.
      const [loaded, setLoaded] = useState(null);
      const onSize = recipe.coverWidth ? undefined : (dims) => dims.width > 0 && dims.height > 0 && setLoaded(dims);
      const badges = [];
      if ((recipe.inputs ?? []).length > 0) badges.push(h(Badge, { key: 'in' }, t('badgePhoto')));
      if (recipe.params?.frames) badges.push(h(Badge, { key: 'gif' }, 'GIF'));
      if (recipe.origin === 'mine') badges.push(h(Badge, { key: 'mine' }, t('originMine')));
      else if (isRemote(recipe.ref)) badges.push(h(Badge, { key: 'com' }, t('originCommunity')));
      const meta = [
        recipe.stats?.votes ? t('votes', { n: recipe.stats.votes }) : null,
        recipe.uses ? t('usedTimes', { n: recipe.uses }) : null,
        recipe.author && isRemote(recipe.ref) ? authorName(recipe.author) : null,
      ].filter(Boolean);
      return h(
        'figure',
        {
          'data-dsh-images-recipe': recipe.ref,
          role: 'button',
          tabIndex: 0,
          onClick: () => onOpen(recipe),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(recipe);
            }
          },
          style: { position: 'relative', margin: 0, borderRadius: 12, overflow: 'hidden', background: C.layer2, border: `1px solid ${C.border1}`, cursor: 'pointer' },
        },
        h(
          'div',
          { style: { position: 'relative', aspectRatio: cardAspect(coverRatio(recipe, loaded)), lineHeight: 0, overflow: 'hidden' } },
          h(RecipeCover, { recipe, lang, onSize }),
          badges.length > 0 ? h('div', { style: { position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5, lineHeight: 1 } }, badges) : null,
          recipe.fillCoverUrl && onFillCover
            ? h(
                'button',
                {
                  type: 'button',
                  'data-dsh-images-fill-cover': recipe.ref,
                  title: t('fillCoverTip'),
                  onClick: (e) => {
                    e.stopPropagation();
                    onFillCover(recipe);
                  },
                  onKeyDown: (e) => e.stopPropagation(),
                  style: { position: 'absolute', top: 8, right: 8, font: 'inherit', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: C.label, color: 'var(--dsw-alias-label-primary-foreground, #fff)', lineHeight: 1.5, whiteSpace: 'nowrap' },
                },
                t('fillCover'),
              )
            : null,
        ),
        h(
          'figcaption',
          { style: { padding: '8px 10px 10px', fontSize: SMALL, lineHeight: 1.45 } },
          h('div', { style: { color: C.primary, fontWeight: 600 } }, pickText(recipe.title, lang)),
          pickText(recipe.summary, lang)
            ? h('div', { style: { marginTop: 2, color: C.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' } }, pickText(recipe.summary, lang))
            : null,
          meta.length > 0 ? h('div', { style: { marginTop: 3, color: C.faint, fontSize: 11.5 } }, meta.join(' · ')) : null,
        ),
      );
    }

    /** Sort for the "all" view: the user's own first (newest first), the built-in ones, then the community's by votes. */
    function orderRecipes(list) {
      const rank = (r) => (r.origin === 'mine' ? 0 : r.origin === 'builtin' ? 1 : 2);
      return list
        .map((r, i) => ({ r, i }))
        .sort((a, b) => rank(a.r) - rank(b.r) || (a.r.origin === 'mine' ? (b.r.createdAt ?? 0) - (a.r.createdAt ?? 0) : 0) || (rank(a.r) === 2 ? (b.r.stats?.votes ?? 0) - (a.r.stats?.votes ?? 0) : 0) || a.i - b.i)
        .map((x) => x.r);
    }

    function matches(recipe, query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return true;
      const hay = [recipe.title?.zh, recipe.title?.en, recipe.summary?.zh, recipe.summary?.en, ...(recipe.tags ?? []), recipe.category, recipe.author, recipe.source?.repo].filter(Boolean).join(' ').toLowerCase();
      return terms.every((term) => hay.includes(term));
    }

    /** The Recipes tab: search, filters and the grid of cards. */
    function RecipesView({ t, lang, data, failed, onOpen, onFillCover, onImportFile }) {
      const [query, setQuery] = useState('');
      const [category, setCategory] = useState('');
      const [origin, setOrigin] = useState('');
      const [dragging, setDragging] = useState(false);
      if (failed) return h('div', { style: { padding: 24, color: C.faint } }, t('recipesUnavailable'));
      if (data === null) return h('div', { style: { padding: 24, color: C.faint } }, '…');
      const all = Array.isArray(data.recipes) ? data.recipes : [];
      const remoteSources = (data.sources ?? []).filter((s) => s.kind === 'remote');
      const origins = [
        ['', t('originAll')],
        ['builtin', t('originBuiltin')],
        ['mine', t('originMine')],
        ...(remoteSources.length > 0 ? [['remote', t('originCommunity')]] : []),
      ];
      const byOrigin = all.filter((r) => origin === '' || (origin === 'remote' ? isRemote(r.ref) : r.origin === origin));
      const present = CATEGORY_ORDER.filter((c) => byOrigin.some((r) => r.category === c));
      const shown = orderRecipes(byOrigin.filter((r) => (category === '' || r.category === category) && matches(r, query)));

      let empty = null;
      if (shown.length === 0) {
        if (query !== '' || category !== '') empty = t('recipesNoMatch');
        else if (origin === 'mine') empty = t('mineEmpty');
        else if (origin === 'remote') {
          const broken = remoteSources.find((s) => s.error);
          empty = broken && !remoteSources.some((s) => s.count > 0) ? t('communityUnreachable', { reason: broken.error }) : t('communityEmpty');
        } else empty = t('recipesEmpty');
      }

      const filters = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px 4px' } },
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          h('input', {
            type: 'search',
            value: query,
            placeholder: t('recipeSearch'),
            'aria-label': t('recipeSearch'),
            onChange: (e) => setQuery(e.target.value),
            style: { ...inputStyle, width: 'min(280px, 100%)', padding: '6px 11px', fontSize: 12.5 },
          }),
          h('span', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, origins.map(([key, label]) => h(Chip, { key: key || 'all', active: origin === key, onClick: () => setOrigin(key), 'data-dsh-images-origin': key || 'all' }, label))),
        ),
        present.length > 1
          ? h(
              'div',
              { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
              h(Chip, { active: category === '', onClick: () => setCategory('') }, t('catAll')),
              present.map((c) => h(Chip, { key: c, active: category === c, onClick: () => setCategory(category === c ? '' : c), 'data-dsh-images-category': c }, t(`cat_${c}`))),
            )
          : null,
      );

      return h(
        'div',
        {
          'data-dsh-images-recipes': true,
          onDragOver: (e) => {
            if (e.dataTransfer && [...(e.dataTransfer.types ?? [])].includes('Files')) {
              e.preventDefault();
              if (!dragging) setDragging(true);
            }
          },
          onDragLeave: () => setDragging(false),
          onDrop: (e) => {
            const file = e.dataTransfer?.files?.[0];
            setDragging(false);
            if (!file) return;
            e.preventDefault();
            onImportFile(file);
          },
          style: { position: 'relative', minHeight: '60%', outline: dragging ? `2px dashed ${C.label}` : 'none', outlineOffset: -8, borderRadius: 12 },
        },
        filters,
        empty
          ? h('div', { style: { padding: '36px 24px', color: C.muted, maxWidth: 560, lineHeight: 1.6 } }, empty)
          : h(
              'div',
              { 'data-dsh-images-recipe-grid': true, style: { padding: '12px 24px 60px', columnWidth: 210, columnGap: 14 } },
              shown.map((r) => h('div', { key: r.ref, style: { breakInside: 'avoid', marginBottom: 14 } }, h(RecipeCard, { t, lang, recipe: r, onOpen, onFillCover }))),
            ),
      );
    }

    const subtleLink = { font: 'inherit', fontSize: 12, color: C.label, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 };

    /** Escape closes the drawer that calls this (the settings drawer handles its own). */
    function useEscape(onClose) {
      const closeRef = useRef(onClose);
      closeRef.current = onClose;
      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const key = (e) => {
          if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current();
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
      }, []);
    }

    /**
     * One recipe: fill its blanks and start a conversation with it, or pass it on —
     * a recipe code, a share card, the community. The user's own can be edited.
     */
    function RecipeSheet({ t, lang, recipe, drafts, onClose, onToast, onChanged }) {
      useEscape(onClose);
      const [values, setValues] = useState({});
      const [extra, setExtra] = useState('');
      const [showPrompt, setShowPrompt] = useState(false);
      const [share, setShare] = useState(null);
      const [target, setTarget] = useState(0);
      const [editing, setEditing] = useState(null);
      const [confirmDelete, setConfirmDelete] = useState(false);
      const [busy, setBusy] = useState('');
      const mine = recipe.origin === 'mine';
      const picture = recipe.origin === 'image';
      const remote = isRemote(recipe.ref);
      const title = pickText(recipe.title, lang);

      const [starting, setStarting] = useState(false);
      const start = () => {
        if (starting) return;
        const text = draftMessage(t, lang, recipe, values, extra);
        setStarting(true);
        Promise.resolve(drafts?.start?.(text))
          .catch(() => false)
          .then((started) => {
            setStarting(false);
            if (started) {
              onToast(t((recipe.inputs ?? []).length > 0 ? 'draftStartedAttach' : 'draftStarted'));
              onClose();
            } else {
              copyText(text);
              onToast(t('draftCopied'));
            }
          });
      };
      const run = (key, job) => {
        if (busy) return;
        setBusy(key);
        Promise.resolve()
          .then(job)
          .catch(() => onToast(t('actionFailed')))
          .finally(() => setBusy(''));
      };
      const copyCode = () =>
        run('code', async () => {
          const body = await postJson(RECIPES_ROUTE, { action: 'export', ref: recipe.ref, lang });
          if (!body?.ok) throw new Error(body?.reason);
          copyText(body.text);
          onToast(t('codeCopied'));
        });
      const card = () =>
        run('card', async () => {
          const blob = await renderCard(t, lang, recipe);
          const body = await postJson(RECIPES_ROUTE, { action: 'card', ref: recipe.ref, png: bytesToBase64(await blob.arrayBuffer()) });
          if (!body?.ok) throw new Error(body?.reason);
          saveBlob(base64ToBlob(body.png, 'image/png'), `${recipe.id || 'recipe'}-card.png`);
          onToast(t('cardSaved'));
        });
      const prepareShare = () =>
        run('share', async () => {
          const body = await postJson(RECIPES_ROUTE, { action: 'submit', ref: recipe.ref, lang });
          if (!body?.ok) throw new Error(body?.reason);
          setTarget(0);
          setShare(body);
        });
      const save = () =>
        run('save', async () => {
          const body = await postJson(RECIPES_ROUTE, picture ? { action: 'save-image', id: recipe.image } : { action: 'copy', ref: recipe.ref });
          if (!body?.ok) throw new Error(body?.reason);
          onToast(t(body.duplicate ? 'alreadyMine' : 'savedMine'));
          onChanged(body.recipe);
        });
      const remove = () =>
        run('delete', async () => {
          const body = await postJson(RECIPES_ROUTE, { action: 'delete', ref: recipe.ref });
          if (!body?.ok) throw new Error(body?.reason);
          onToast(t('recipeDeleted'));
          onChanged(null);
        });
      const saveEdit = () =>
        run('edit', async () => {
          const names = slotNames(editing.prompt);
          const patch = {
            title: { ...recipe.title, [lang.startsWith('zh') ? 'zh' : 'en']: editing.title },
            summary: { ...recipe.summary, [lang.startsWith('zh') ? 'zh' : 'en']: editing.summary },
            category: editing.category,
            prompt: editing.prompt,
            params: { ...recipe.params, size: editing.size },
            slots: names.map((name) => ({ name, label: editing.labels[name] ? { [lang.startsWith('zh') ? 'zh' : 'en']: editing.labels[name] } : { en: name }, default: editing.defaults[name] ?? '' })),
          };
          const body = await postJson(RECIPES_ROUTE, { action: 'update', ref: recipe.ref, patch });
          if (!body?.ok) {
            onToast(t('editFailed', { reason: body?.reason ?? '' }));
            return;
          }
          setEditing(null);
          onToast(t('recipeSaved'));
          onChanged(body.recipe);
        });
      const beginEdit = () =>
        setEditing({
          title: title,
          summary: pickText(recipe.summary, lang),
          category: recipe.category,
          size: recipe.params?.size ?? '1024x1024',
          prompt: recipe.prompt,
          labels: Object.fromEntries((recipe.slots ?? []).map((s) => [s.name, pickText(s.label, lang)])),
          defaults: Object.fromEntries((recipe.slots ?? []).map((s) => [s.name, s.default ?? ''])),
        });

      const meta = [
        t(`cat_${recipe.category}`),
        recipe.params?.size && recipe.params.size !== 'auto' ? recipe.params.size.replace('x', '×') : null,
        recipe.params?.frames ? `GIF · ${t('frames', { n: recipe.params.frames })}` : null,
        recipe.uses ? t('usedTimes', { n: recipe.uses }) : null,
        Array.isArray(recipe.tested) && recipe.tested.length > 0 ? t('testedWith', { models: recipe.tested.join(', ') }) : null,
      ].filter(Boolean);

      const credit = [];
      if (recipe.source?.repo || recipe.source?.author) {
        credit.push(
          h(
            'div',
            { key: 'src', style: hintStyle },
            t('creditFrom'),
            recipe.source.url ? h('button', { type: 'button', style: subtleLink, onClick: () => openExternal(recipe.source.url) }, recipe.source.repo || recipe.source.url) : recipe.source.repo,
            recipe.source.author ? ` · ${recipe.source.author}` : '',
            recipe.source.license ? ` · ${recipe.source.license}` : '',
          ),
        );
      }
      if (remote) {
        const issueUrl = issuePage(recipe);
        credit.push(
          h(
            'div',
            { key: 'com', style: { ...hintStyle, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' } },
            recipe.author ? h('span', null, t('sharedBy', { author: authorName(recipe.author) })) : null,
            recipe.stats?.votes ? h('span', null, t('votes', { n: recipe.stats.votes })) : null,
            issueUrl ? h('button', { type: 'button', style: subtleLink, onClick: () => openExternal(issueUrl) }, t('worksWall', { n: recipe.stats?.works ?? 0 })) : null,
          ),
        );
        if (issueUrl && recipe.fillCoverUrl) {
          credit.push(
            h(
              'div',
              { key: 'fill', 'data-dsh-images-fill-note': true, style: { ...hintStyle, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' } },
              h('span', null, t('fillCoverNote')),
              h(DrawerButton, { primary: true, 'data-dsh-images-fill-cover': recipe.ref, onClick: () => fillCover(t, recipe, onToast) }, t('fillCoverButton')),
            ),
          );
        }
      }

      let body;
      if (editing) {
        const names = slotNames(editing.prompt);
        const set = (patch) => setEditing((e) => ({ ...e, ...patch }));
        body = [
          h('label', { key: 'title', style: field }, h('span', { style: labelStyle }, t('editTitle')), h('input', { value: editing.title, onChange: (e) => set({ title: e.target.value }), style: inputStyle })),
          h('label', { key: 'summary', style: field }, h('span', { style: labelStyle }, t('editSummary')), h('input', { value: editing.summary, onChange: (e) => set({ summary: e.target.value }), style: inputStyle })),
          h(
            'div',
            { key: 'row', style: { display: 'flex', gap: 10 } },
            h('label', { style: { ...field, flex: 1 } }, h('span', { style: labelStyle }, t('editCategory')), h('select', { value: editing.category, onChange: (e) => set({ category: e.target.value }), style: inputStyle }, CATEGORY_ORDER.map((c) => h('option', { key: c, value: c }, t(`cat_${c}`))))),
            h('label', { style: { ...field, flex: 1 } }, h('span', { style: labelStyle }, t('size')), h('select', { value: editing.size, onChange: (e) => set({ size: e.target.value }), style: inputStyle }, ['1024x1024', '1536x1024', '1024x1536', 'auto'].map((sz) => h('option', { key: sz, value: sz }, sz === 'auto' ? t('auto') : sz.replace('x', '×'))))),
          ),
          h(
            'label',
            { key: 'prompt', style: field },
            h('span', { style: labelStyle }, t('editPrompt')),
            h('textarea', { value: editing.prompt, rows: 9, onChange: (e) => set({ prompt: e.target.value }), style: { ...inputStyle, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 } }),
            h('span', { style: hintStyle }, t('editPromptHint')),
          ),
          ...names.map((name) =>
            h(
              'div',
              { key: `slot-${name}`, style: { display: 'flex', gap: 8, alignItems: 'flex-end' } },
              h('label', { style: { ...field, flex: 1 } }, h('span', { style: labelStyle }, t('editSlotLabel', { name })), h('input', { value: editing.labels[name] ?? '', placeholder: name, onChange: (e) => set({ labels: { ...editing.labels, [name]: e.target.value } }), style: inputStyle })),
              h('label', { style: { ...field, flex: 2 } }, h('span', { style: labelStyle }, t('editSlotDefault')), h('input', { value: editing.defaults[name] ?? '', onChange: (e) => set({ defaults: { ...editing.defaults, [name]: e.target.value } }), style: inputStyle })),
            ),
          ),
        ];
      } else if (share) {
        const p = share.recipe ?? {};
        const targets = share.targets ?? [{ url: share.url, issues: 'reviewed', default: true }];
        const to = targets[target] ?? targets[0];
        const open = to.issues === 'open';
        const targetName = (x) => (x.title ? pickText(x.title, lang) : x.default ? t('communityDefault') : x.home);
        body = [
          targets.length > 1
            ? h(
                'div',
                { key: 'targets', role: 'radiogroup', 'aria-label': t('shareTo'), style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('span', { style: labelStyle }, t('shareTo')),
                ...targets.map((x, i) =>
                  h(
                    'label',
                    { key: x.key ?? i, 'data-dsh-images-share-target': x.key, style: { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, cursor: 'pointer' } },
                    h('input', { type: 'radio', name: 'dsh-images-share-target', checked: i === target, onChange: () => setTarget(i) }),
                    h('span', null, targetName(x), h('span', { style: { ...hintStyle, marginLeft: 6 } }, t(x.issues === 'open' ? 'shareLive' : 'shareReviewed'))),
                  ),
                ),
              )
            : null,
          h('div', { key: 'note', style: { fontSize: 13, lineHeight: 1.6 } }, open ? t('shareIntroOpen', { name: targetName(to) }) : t('shareIntro')),
          h(
            'div',
            { key: 'preview', 'data-dsh-images-share-preview': true, style: { border: `1px solid ${C.border1}`, borderRadius: 10, padding: '10px 12px', background: C.layer1, fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 } },
            h('div', null, h('b', null, t('editTitle')), t('colon'), [p.title?.zh, p.title?.en].filter(Boolean).join(' / ')),
            pickText(p.summary, lang) ? h('div', null, h('b', null, t('editSummary')), t('colon'), pickText(p.summary, lang)) : null,
            h('div', null, h('b', null, t('editCategory')), t('colon'), t(`cat_${p.category}`), p.params?.size ? ` · ${p.params.size}` : '', p.params?.frames ? ` · GIF ${p.params.frames}` : ''),
            h('div', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto', color: C.muted } }, p.prompt),
          ),
          (p.slots ?? []).length === 0
            ? h(
                'div',
                { key: 'blanks', 'data-dsh-images-share-blanks': true, style: { ...hintStyle, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' } },
                h('span', null, t('shareNoBlanks')),
                h(DrawerButton, { 'data-dsh-images-make-template': true, onClick: () => void startTemplate(t, lang, recipe, drafts, onToast).then((started) => started && onClose()) }, t('makeTemplateFirst')),
              )
            : null,
          h('div', { key: 'private', style: hintStyle }, t(open ? 'sharePrivacyOpen' : 'sharePrivacy')),
          h('div', { key: 'cover', style: hintStyle }, t(recipe.coverUrl ? (open ? 'shareCoverOpen' : 'shareCover') : open ? 'shareNoCoverOpen' : 'shareNoCover')),
        ];
      } else {
        body = [
          // The whole cover, at most 340 high: a box of its shape, centred. `contain` keeps it whole
          // even when its size was not known yet.
          h(
            'div',
            {
              key: 'cover',
              'data-dsh-images-recipe-cover': true,
              style: { borderRadius: 12, overflow: 'hidden', width: recipe.coverUrl ? `min(100%, ${Math.round(340 * coverRatio(recipe))}px)` : undefined, margin: '0 auto', maxHeight: 340, aspectRatio: String(Math.round(coverRatio(recipe) * 10_000) / 10_000), background: C.layer2, lineHeight: 0 },
            },
            h(RecipeCover, { recipe, lang, big: true, fit: recipe.coverUrl ? 'contain' : 'cover' }),
          ),
          h(
            'div',
            { key: 'head', style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            pickText(recipe.summary, lang) ? h('div', { style: { fontSize: 13.5, lineHeight: 1.55 } }, pickText(recipe.summary, lang)) : null,
            h('div', { style: { fontSize: 12, color: C.faint } }, meta.join(' · ')),
            ...credit,
          ),
          (recipe.inputs ?? []).length > 0
            ? h(
                'div',
                { key: 'inputs', 'data-dsh-images-needs': true, style: { fontSize: 12.5, lineHeight: 1.55, padding: '9px 12px', borderRadius: 10, background: C.layer2, color: C.primary } },
                h('div', { style: { fontWeight: 600 } }, t('needsInputs', { n: recipe.inputs.length })),
                h('div', { style: { color: C.muted } }, recipe.inputs.map((i) => pickText(i.label, lang)).join(t('listSep'))),
                h('div', { style: { ...hintStyle, marginTop: 2 } }, t('needsInputsHint')),
              )
            : null,
          ...(recipe.slots ?? []).map((slot) =>
            h(
              'label',
              { key: `slot-${slot.name}`, style: field },
              h('span', { style: labelStyle }, pickText(slot.label, lang)),
              h('input', {
                value: values[slot.name] ?? '',
                placeholder: slot.default ? t('slotDefault', { value: slot.default }) : '',
                onChange: (e) => setValues((v) => ({ ...v, [slot.name]: e.target.value })),
                'data-dsh-images-slot': slot.name,
                style: inputStyle,
              }),
            ),
          ),
          h(
            'label',
            { key: 'extra', style: field },
            h('span', { style: labelStyle }, t(picture ? 'remixChange' : 'extraWish')),
            h('textarea', { value: extra, rows: 2, placeholder: t(picture ? 'remixChangeHint' : 'extraWishHint'), onChange: (e) => setExtra(e.target.value), 'data-dsh-images-extra': true, style: { ...inputStyle, resize: 'vertical', lineHeight: 1.5 } }),
          ),
          h(
            'div',
            { key: 'prompt', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: { display: 'flex', gap: 12 } }, h('button', { type: 'button', style: subtleLink, onClick: () => setShowPrompt((v) => !v) }, t(showPrompt ? 'hidePrompt' : 'showPrompt')), showPrompt ? h('button', { type: 'button', style: subtleLink, onClick: () => copyText(recipe.prompt) }, t('copyPrompt')) : null),
            showPrompt ? h('div', { style: { fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: C.muted, background: C.layer1, border: `1px solid ${C.border1}`, borderRadius: 9, padding: '9px 11px', maxHeight: 260, overflowY: 'auto', userSelect: 'text' } }, recipe.prompt) : null,
          ),
        ];
      }

      let footer;
      if (editing) {
        footer = h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } }, h(DrawerButton, { onClick: () => setEditing(null) }, t('cancel')), h(DrawerButton, { primary: true, disabled: busy !== '', onClick: saveEdit }, t('save')));
      } else if (share) {
        footer = h(
          'div',
          { style: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' } },
          h(DrawerButton, { onClick: () => setShare(null) }, t('back')),
          recipe.coverUrl ? h(DrawerButton, { onClick: () => saveUrl(recipe.coverUrl, `${recipe.id || 'recipe'}-cover`) }, t('downloadCover')) : null,
          h(
            DrawerButton,
            {
              primary: true,
              'data-dsh-images-open-github': true,
              onClick: () => {
                // The cover goes to the clipboard first (the page would take the focus it needs),
                // so it is one paste in the issue.
                const targets = share.targets ?? [{ url: share.url }];
                const url = (targets[target] ?? targets[0]).url;
                const copied = recipe.coverUrl ? copyImage(recipe.coverUrl).then(() => true, () => false) : Promise.resolve(false);
                copied.then((ok) => {
                  openExternal(url);
                  setShare(null);
                  onToast(t(ok ? 'shareOpenedPaste' : 'shareOpened'));
                });
              },
            },
            t('openGitHub'),
          ),
        );
      } else {
        const secondary = [
          h(DrawerButton, { key: 'code', onClick: copyCode, disabled: busy !== '', 'data-dsh-images-copy-code': true }, t('copyCode')),
          h(DrawerButton, { key: 'card', onClick: card, disabled: busy !== '' }, busy === 'card' ? '…' : t('shareCard')),
          ...(mine || picture ? [h(DrawerButton, { key: 'share', onClick: prepareShare, disabled: busy !== '', 'data-dsh-images-share': true }, t('shareCommunity'))] : []),
          ...(!mine ? [h(DrawerButton, { key: 'save', onClick: save, disabled: busy !== '', 'data-dsh-images-save-recipe': true }, t(picture ? 'saveAsRecipe' : 'saveToMine'))] : []),
          ...(mine ? [h(DrawerButton, { key: 'edit', onClick: beginEdit }, t('edit'))] : []),
          ...(mine
            ? [
                h(
                  'button',
                  {
                    key: 'del',
                    type: 'button',
                    onClick: () => (confirmDelete ? remove() : setConfirmDelete(true)),
                    style: { font: 'inherit', fontSize: 13, padding: '7px 10px', border: 'none', background: 'transparent', color: C.error, cursor: 'pointer' },
                  },
                  t(confirmDelete ? 'confirmDelete' : 'deleteRecipe'),
                ),
              ]
            : []),
        ];
        footer = h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          h(DrawerButton, { primary: true, onClick: start, disabled: starting, 'data-dsh-images-start': true }, t(drafts?.available?.() ? 'startRecipe' : 'copyDraft')),
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, secondary),
        );
      }

      return h(DrawerFrame, { t, onClose, footer, title: editing ? t('editRecipe') : share ? t('shareTitle') : title, width: 480 }, body);
    }

    /** Add a recipe someone shared: paste its code, or pick the picture that carries it. */
    function ImportDrawer({ t, onClose, onImported, importFile }) {
      useEscape(onClose);
      const [text, setText] = useState('');
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const fileInput = useRef(null);
      const submit = () => {
        if (busy || text.trim() === '') return;
        setBusy(true);
        setError('');
        postJson(RECIPES_ROUTE, { action: 'import', text })
          .then((body) => {
            if (body?.ok) onImported(body);
            else setError(t('importFailed', { reason: body?.reason ?? '' }));
          })
          .catch(() => setError(t('actionFailed')))
          .finally(() => setBusy(false));
      };
      return h(
        DrawerFrame,
        {
          t,
          onClose,
          title: t('importTitle'),
          footer: h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } }, h(DrawerButton, { onClick: onClose }, t('cancel')), h(DrawerButton, { primary: true, disabled: busy || text.trim() === '', onClick: submit, 'data-dsh-images-import-submit': true }, t('importDo'))),
        },
        h(
          'label',
          { style: field },
          h('span', { style: labelStyle }, t('importPaste')),
          h('textarea', { value: text, rows: 7, placeholder: 'dshimg1.…', onChange: (e) => setText(e.target.value), 'data-dsh-images-import-text': true, style: { ...inputStyle, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 } }),
        ),
        h(
          'div',
          { style: field },
          h('span', { style: labelStyle }, t('importPicture')),
          h('input', {
            ref: fileInput,
            type: 'file',
            accept: 'image/png',
            onChange: (e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file, (message) => setError(message));
            },
            style: { fontSize: 12.5, color: C.muted },
          }),
          h('span', { style: hintStyle }, t('importPictureHint')),
        ),
        error ? h('div', { role: 'alert', style: { fontSize: 12.5, color: C.error, lineHeight: 1.5 } }, error) : null,
      );
    }

    /** The community sources the Recipes tab reads: the default one and any the user added. */
    function SourcesDrawer({ t, lang, data, onClose, onData }) {
      useEscape(onClose);
      const [url, setUrl] = useState('');
      const [busy, setBusy] = useState(false);
      const remote = (data?.sources ?? []).filter((s) => s.kind === 'remote');
      const send = (body) => {
        setBusy(true);
        postJson(RECIPES_ROUTE, body)
          .then((next) => next?.ok && onData(next))
          .catch(() => {})
          .finally(() => setBusy(false));
      };
      const setUrls = (urls) => send({ action: 'sources', urls });
      return h(
        DrawerFrame,
        {
          t,
          onClose,
          title: t('sourcesTitle'),
          footer: h('div', { style: { display: 'flex', gap: 8, justifyContent: 'space-between' } }, h(DrawerButton, { onClick: () => openExternal(COMMUNITY_HOME) }, t('communityHome')), h(DrawerButton, { primary: true, disabled: busy, onClick: () => send({ action: 'refresh' }) }, busy ? '…' : t('refreshSources'))),
        },
        h('div', { style: hintStyle }, t('sourcesHint')),
        remote.length === 0 ? h('div', { style: { fontSize: 12.5, color: C.muted } }, t('sourcesNone')) : null,
        ...remote.map((s) =>
          h(
            'div',
            { key: s.url, 'data-dsh-images-source': s.key, style: { border: `1px solid ${C.border1}`, borderRadius: 10, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 3 } },
            h(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'baseline' } },
              s.home
                ? h('button', { type: 'button', style: { ...subtleLink, fontWeight: 600, fontSize: 13 }, onClick: () => openExternal(s.home) }, s.title ? pickText(s.title, lang) : s.default ? t('communityDefault') : s.url)
                : h('span', { style: { fontWeight: 600, fontSize: 13 } }, s.title ? pickText(s.title, lang) : s.default ? t('communityDefault') : s.url),
              s.issues === 'open' ? h('span', { style: hintStyle }, t('sourceIssues')) : null,
              h('span', { style: { flex: 1 } }),
              h('button', { type: 'button', style: { ...subtleLink, color: C.error }, onClick: () => setUrls(remote.filter((r) => r.url !== s.url).map((r) => r.url)) }, t('removeSource')),
            ),
            h('div', { style: { ...hintStyle, wordBreak: 'break-all' } }, s.url),
            h('div', { style: hintStyle }, s.error && !s.count ? t('sourceError', { reason: s.error }) : t('sourceStatus', { n: s.count, when: s.fetchedAt ? new Date(s.fetchedAt).toLocaleString() : '—' })),
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8 } },
          h('input', { value: url, placeholder: t('sourcePlaceholder'), onChange: (e) => setUrl(e.target.value), 'aria-label': t('addSource'), style: { ...inputStyle, flex: 1 } }),
          h(
            DrawerButton,
            {
              disabled: busy || !/^https:\/\//i.test(url.trim()),
              onClick: () => {
                setUrls([...remote.map((r) => r.url), url.trim()]);
                setUrl('');
              },
            },
            t('addSource'),
          ),
        ),
        !remote.some((s) => s.default) ? h('button', { type: 'button', style: { ...subtleLink, alignSelf: 'flex-start' }, onClick: () => setUrls([...remote.map((r) => r.url), 'https://raw.githubusercontent.com/kadaliao/dsh-images-recipes/main/index.json']) }, t('restoreDefault')) : null,
      );
    }

    // --- dictionaries -------------------------------------------------------------------

    const DICTIONARY = {
      en: {
        title: 'Images',
        count: '{n} images',
        spent: 'spent {amount}',
        settings: 'Settings',
        settingsTitle: 'Image generation',
        saved: 'Settings saved. The next picture uses them.',
        secProvider: 'Connection',
        secModel: 'Model',
        secBilling: 'Billing',
        provider: 'Provider',
        providerSession: 'The session\'s provider ({name})',
        providerSessionNone: 'The session\'s provider',
        providerCustom: 'Custom base URL',
        baseURL: 'Base URL',
        baseURLHint: 'Leave empty to use the provider\'s own URL; the request goes to <base URL>/images/generations.',
        apiKey: 'API key',
        apiKeyHint: 'Stored in the Harness credential store on this machine, never shown again. Leave empty to keep using the provider\'s key.',
        keyStored: 'Saved {hint} — leave empty to keep it',
        keyFromProvider: 'Using the provider\'s key {hint} — enter one to override',
        keyNone: 'No key yet',
        keyWillClear: 'The saved key will be removed on save',
        clearKey: 'Remove saved key',
        probe: 'Test connection & list models',
        probing: 'Connecting…',
        probeOk: 'Connected: {n} models, {images} of them image models.',
        probeOkNoImages: 'Connected: {n} models, none of them listed as an image model — type the image model\'s id below; gateways often serve it without listing it.',
        probeFailed: 'Could not connect: {reason}',
        model: 'Image model',
        modelHint: 'As the provider names it, e.g. gpt-image-1.5. Type to search the list; test the connection to add the provider\'s models.',
        modelHintListed: 'Type to search the list, or enter any id the provider serves.',
        comboToggle: 'Show models',
        comboNoMatch: 'Nothing matches; the id as typed is used.',
        comboMore: '{n} more; keep typing to narrow it down.',
        groupUsed: 'Used before',
        groupProvider: 'From the provider',
        groupCatalog: 'In the {catalog} price list',
        tagImage: 'image',
        size: 'Default size',
        quality: 'Quality',
        auto: 'auto',
        default: 'default',
        pricePerImage: 'Price per image',
        currency: 'Currency',
        pricePerImageHint: 'Only used when the provider reports no usage and no price list knows the model (the built-in one was checked {date}).',
        priceProvider: 'The provider states {price} per image.',
        priceList: 'Built-in list for {family}: {samples} per image at this quality (as of {date}). Exact when the provider reports token usage.',
        priceManual: 'Unknown to the price lists; your price of {price} per image applies.',
        priceUnknown: 'Neither the provider, the built-in list nor the {catalog} price list knows it; set a price per image below, or costs stay blank.',
        priceUnknownOffline: 'Not in the built-in list, and the {catalog} price list could not be downloaded; set a price per image below, or costs stay blank.',
        priceCatalogTokens: 'The {catalog} price list has {name}: text in {textIn}, image out {imageOut} per million tokens, applied to the usage the provider reports.',
        priceCatalogFlat: 'The {catalog} price list has {name} at {price} per image.',
        priceNoUsageFlat: 'A reply without usage counts {price} per image.',
        priceNoUsageManual: 'A reply without usage counts your {price} per image.',
        priceNoUsageBlank: 'A reply without usage gets no cost.',
        catalogNear: '{name} (closest entry)',
        catalogStatus: '{catalog} price list: {n} image models, as of {date}.',
        catalogLoading: 'Downloading the {catalog} price list…',
        catalogFailed: 'Could not download the {catalog} price list: {reason}',
        catalogNotYet: 'The {catalog} price list is downloaded the first time a model needs it.',
        catalogRefresh: 'Update',
        catalogRetry: 'Download',
        statsTotal: '{n} images so far',
        statsNoCost: 'no cost recorded',
        cancel: 'Cancel',
        save: 'Save',
        toolTitle: 'Image',
        preparing: 'preparing…',
        generating: 'generating…',
        loading: 'loading…',
        failed: 'The image could not be generated.',
        noImage: 'No image came back.',
        frames: '{n} frames',
        fromInputs: 'from {n} input image(s)',
        gifUnverified: '{model} is not known to support GIF frames; the animation may not line up. gpt-image models are known to work.',
        gifModelHint: 'This model may not support GIF generation; gpt-image models are known to work.',
        zoomIn: 'Zoom in (+, wheel)',
        zoomOut: 'Zoom out (−, wheel)',
        zoomReset: 'Fit to screen (0)',
        enlarge: 'Enlarge',
        download: 'Download',
        more: 'More',
        copyPrompt: 'Copy prompt',
        delete: 'Remove from gallery',
        close: 'Close',
        next: 'Next',
        previous: 'Previous',
        viewer: 'Image viewer',
        openSession: 'Open conversation',
        openSessionTitled: 'Open the conversation it was drawn in: {title}',
        sessionArchived: 'The conversation this picture came from is archived. Unarchive it to open it.',
        sessionGone: 'The conversation this picture came from no longer exists.',
        unarchiveAndOpen: 'Unarchive and open',
        unarchiving: 'Unarchiving…',
        unarchiveFailed: 'Could not unarchive it; unarchive it from the sidebar instead.',
        refresh: 'Refresh',
        loadMore: 'Load more',
        empty: 'No images yet. Ask the model for a picture in any conversation — "draw me a poster for…" — and it appears here, newest first.',
        unavailable: 'The gallery is not reachable. Refresh the page, or check the plugin is enabled.',
        justNow: 'just now',
        minutesAgo: '{n} min ago',
        hoursAgo: '{n} h ago',
        daysAgo: '{n} d ago',
        lang: "en",
        testedWith: "tried on {models}",
        withRecipe: "Recipe · {title}",
        tabGallery: "Gallery",
        tabRecipes: "Recipes",
        recipeCount: "{n} recipes",
        importRecipe: "Import",
        sources: "Sources",
        recipeGone: "That recipe is no longer in your library.",
        alreadyMine: "It is already among your recipes.",
        imported: "Imported \"{title}\" into your recipes.",
        importNotPng: "Only a PNG can carry a recipe; paste the recipe code instead.",
        importFailed: "Could not import: {reason}",
        actionFailed: "That did not work. Try again.",
        savedMine: "Saved to your recipes.",
        view: "View",
        showOffCopied: "The picture is copied: paste it into a comment on the page that opened.",
        showOffManual: "Opened the recipe's page: attach the picture to a comment there.",
        remix: "Make one like this",
        saveAsRecipe: "Save as a recipe, as is",
        makeTemplate: 'Make a recipe template',
        downloadWithRecipe: "Download with its recipe",
        showOff: "Post to the works wall",
        cardCredit: "Adapted from {repo}",
        cardBy: "Shared by {author}",
        cardFooter: "Drop this picture into DSH Images → Recipes → Import to use it",
        draftUse: "Draw a picture with the \"{title}\" recipe (recipe: {ref}).",
        draftRemix: "Draw another one the way this picture was made (recipe: {ref}).",
        draftTemplatePicture: 'Make this gallery picture a reusable recipe of mine (recipe: {ref}): read its prompt with image_recipes get, and turn the parts worth changing (words in the picture, the subject, colors, style details) into blanks like {blank}, named in English. Give each blank a label in Chinese and English and a default taken from this picture, write a title and a summary, keep its size, frames and input images as they are, then keep it with image_recipes save and fromImage "{id}", so this picture is its cover.',
        draftTemplateMine: 'Give my recipe "{title}" blanks to fill in (recipe: {ref}): read it with image_recipes get, and turn the parts worth changing (words in the picture, the subject, colors, style details) into blanks like {blank}, named in English. Give each blank a label in Chinese and English and a default taken from the prompt as it is, then change the recipe with image_recipes update.',
        templateStarted: 'A new conversation is ready in the Images workspace: press Send and the model picks the blanks. The template shows under Recipes → Mine.',
        shareNoBlanks: 'This recipe has no blanks to fill in, so others can only draw this same picture again. Let the model pick the parts worth changing (words, colors, the subject) first, then share the template.',
        makeTemplateFirst: 'Make it a template first',
        colon: ": ",
        draftChange: "Change: {text}",
        draftExtra: "Also: {text}",
        draftAttach: "Attached: {list}.",
        listSep: "; ",
        remixTitle: "Make one like this",
        inputN: "Input image {n}",
        badgePhoto: "Photo",
        originMine: "Mine",
        originCommunity: "Community",
        votes: "{n} 👍",
        usedTimes: "used {n}×",
        recipesUnavailable: "The recipes are not reachable. Refresh the page, or check the plugin is enabled.",
        originAll: "All",
        originBuiltin: "Built-in",
        recipesNoMatch: "No recipe matches.",
        mineEmpty: "No recipes of your own yet. In the gallery, open a picture's ⋯ menu and choose \"Save as a recipe\", or import one someone shared with you.",
        communityUnreachable: "The community source cannot be reached right now ({reason}).",
        communityEmpty: "No community recipes yet. Share one of yours to be the first.",
        recipesEmpty: "No recipes.",
        recipeSearch: "Search recipes",
        catAll: "All",
        cat_photo: "Photo",
        cat_handdrawn: "Hand-drawn",
        cat_editorial: "Magazine & poster",
        cat_infographic: "Infographic",
        cat_3d: "3D",
        cat_sticker: "Sticker & GIF",
        cat_illustration: "Illustration",
        cat_product: "Product",
        cat_comic: "Comic",
        draftStarted: "A new conversation is ready in the Images workspace with the recipe in the composer: press Send.",
        draftStartedAttach: "A new conversation is ready in the Images workspace: attach the picture(s) in the composer, then send.",
        draftCopied: "Copied the message: paste it into any conversation.",
        codeCopied: "Recipe code copied: send it to anyone who uses DSH Images.",
        cardSaved: "Share card saved: it carries the recipe inside.",
        recipeDeleted: "Recipe deleted.",
        editFailed: "Could not save: {reason}",
        recipeSaved: "Recipe saved.",
        creditFrom: "From ",
        sharedBy: "Shared by {author}",
        worksWall: "Works wall ({n})",
        editTitle: "Title",
        editSummary: "Summary",
        editCategory: "Category",
        editPrompt: "Prompt template",
        editPromptHint: "Write {{name}} for a blank the user fills in; give each blank a default below.",
        editSlotLabel: "Blank {name}",
        editSlotDefault: "Default",
        shareIntro: "This opens a new issue in the community repository on GitHub with the recipe filled in. Once it is reviewed, everyone who follows the community source sees it.",
        sharePrivacy: "Shared publicly: the title, summary, prompt and parameters above. Your photos and conversations are not shared.",
        shareCover: "GitHub cannot take a picture through a link, so Open GitHub copies the cover to the clipboard: paste it into the issue's Cover field (⌘V, or Ctrl+V on Windows). Or download it here and drag it in.",
        shareNoCover: "This recipe has no cover yet: drag a picture made with it into the issue's Cover field.",
        shareTitle: "Share recipe",
        shareTo: "Share to",
        shareLive: "live once submitted",
        shareReviewed: "reviewed first",
        shareIntroOpen: "This opens a new issue in {name} with the recipe filled in. Once you submit it, everyone who follows that repository sees it under Recipes; there is no review. Edit the issue to change the recipe, close it to take it down.",
        sharePrivacyOpen: "Shared with everyone who can open that repository: the title, summary, prompt and parameters above. Your photos and conversations are not shared.",
        shareCoverOpen: "GitHub cannot take a picture through a link, so Open GitHub copies the cover to the clipboard: paste it into the issue under Cover (⌘V, or Ctrl+V on Windows). The first picture in the issue is the cover.",
        shareNoCoverOpen: "This recipe has no cover yet: drag a picture made with it into the issue. Its first picture is the cover.",
        needsInputs: "Works on {n} picture(s) of yours",
        needsInputsHint: "Attach them in the composer before you send.",
        slotDefault: "Default: {value}",
        remixChange: "What to change",
        extraWish: "Anything else (optional)",
        remixChangeHint: "e.g. a different subject, another colour scheme",
        extraWishHint: "e.g. warmer colours, add a title",
        hidePrompt: "Hide the prompt",
        showPrompt: "Show the prompt",
        back: "Back",
        downloadCover: "Download cover",
        openGitHub: "Open GitHub",
        shareOpened: "Opened GitHub: check the issue and submit it there.",
        shareOpenedPaste: "Opened GitHub, and the cover is on the clipboard: paste it under Cover, then submit.",
        fillCover: 'No cover · Add it',
        fillCoverTip: "You shared this recipe and its issue has no cover. This copies the cover and opens the issue: pick ··· → Edit on its text, paste the cover under Cover and save.",
        fillCoverNote: "You shared this recipe and its issue has no cover. Add the cover copies it and opens the issue: pick ··· → Edit on its text, paste the cover under Cover and save.",
        fillCoverButton: 'Add the cover',
        fillCoverCopied: 'Opened the issue, and the cover is on the clipboard: ··· → Edit, paste it under Cover, then save.',
        fillCoverSaved: 'Opened the issue and downloaded the cover: ··· → Edit, drag it under Cover, then save.',
        copyCode: "Copy recipe code",
        shareCard: "Share card",
        shareCommunity: "Share to…",
        saveToMine: "Save to mine",
        edit: "Edit",
        confirmDelete: "Click again to delete",
        deleteRecipe: "Delete",
        startRecipe: "Start a conversation with it",
        copyDraft: "Copy the message",
        editRecipe: "Edit recipe",
        importTitle: "Import a recipe",
        importDo: "Import",
        importPaste: "Paste a recipe code, or the whole message it came in",
        importPicture: "Or pick a picture that carries a recipe",
        importPictureHint: "A share card, or a picture downloaded with its recipe. You can also drop it anywhere on the Recipes tab.",
        sourcesTitle: "Recipe sources",
        communityHome: "Community on GitHub",
        refreshSources: "Refresh",
        sourcesHint: "A source is a GitHub repository whose open issues are its recipes (on your company's GitHub Enterprise, read every ten minutes, or on github.com, read hourly), or a recipe index on the web (a JSON file in the Images recipe format, read once a week). Anyone can start one for a team: a public repository with issues on is enough.",
        sourcePlaceholder: "Repository link, or https://…/index.json",
        sourceIssues: "· its issues are the recipes",
        sourcesNone: "No sources: only the built-in recipes and your own are shown.",
        communityDefault: "DSH Images community",
        removeSource: "Remove",
        sourceError: "Not reachable: {reason}",
        sourceStatus: "{n} recipes · updated {when}",
        addSource: "Add",
        restoreDefault: "Add the DSH Images community source back",
      },
      zh: {
        title: '图片',
        count: '{n} 张',
        spent: '累计 {amount}',
        settings: '设置',
        settingsTitle: '生图设置',
        saved: '已保存，下一张图开始生效。',
        secProvider: '连接',
        secModel: '模型',
        secBilling: '计费',
        provider: '供应商',
        providerSession: '跟随会话（{name}）',
        providerSessionNone: '跟随会话所用的供应商',
        providerCustom: '自定义地址',
        baseURL: '接口地址',
        baseURLHint: '留空则用供应商自己的地址；请求发往 <地址>/images/generations。',
        apiKey: 'API 密钥',
        apiKeyHint: '保存在本机的 Harness 凭据库里，不会再显示。留空则继续用供应商配置的密钥。',
        keyStored: '已保存 {hint}，留空保持不变',
        keyFromProvider: '使用供应商的密钥 {hint}，填写则覆盖',
        keyNone: '尚未设置',
        keyWillClear: '保存时将删除已保存的密钥',
        clearKey: '删除已保存的密钥',
        probe: '测试连接并拉取模型',
        probing: '连接中…',
        probeOk: '连接成功：{n} 个模型，其中 {images} 个是生图模型。',
        probeOkNoImages: '连接成功：{n} 个模型，列表里没有标为生图的；直接在下面填生图模型的 id 即可，网关常常不把它列出来。',
        probeFailed: '连不上：{reason}',
        model: '生图模型',
        modelHint: '按供应商的叫法填写，如 gpt-image-1.5。输入即可在列表里模糊搜索；测试连接后还会列出供应商的模型。',
        modelHintListed: '输入即可模糊搜索，也可以直接填供应商提供的任意模型 id。',
        comboToggle: '展开模型列表',
        comboNoMatch: '没有匹配项，按输入的 id 使用。',
        comboMore: '还有 {n} 个，继续输入以缩小范围。',
        groupUsed: '用过的',
        groupProvider: '供应商列出的',
        groupCatalog: '{catalog} 价目表收录的',
        tagImage: '生图',
        size: '默认尺寸',
        quality: '质量',
        auto: '自动',
        default: '默认',
        pricePerImage: '每张单价',
        currency: '币种',
        pricePerImageHint: '只在供应商不返回用量、且所有价目表都查不到这个模型时使用（内置价目表 {date} 核对）。',
        priceProvider: '供应商报价 {price} / 张。',
        priceList: '内置价目表 {family}：该质量下 {samples} / 张（{date}）。供应商返回用量时按用量精确计算。',
        priceManual: '价目表里都没有这个模型，按你填的 {price} / 张计。',
        priceUnknown: '供应商、内置价目表和 {catalog} 价目表都没有它的价格；在下面填一个单价，否则费用留空。',
        priceUnknownOffline: '内置价目表里没有它，{catalog} 价目表也没能下载；在下面填一个单价，否则费用留空。',
        priceCatalogTokens: '{catalog} 价目表收录了 {name}：文本输入 {textIn}、图片输出 {imageOut}（每百万 token），按供应商返回的用量计算。',
        priceCatalogFlat: '{catalog} 价目表收录了 {name}：每张 {price}。',
        priceNoUsageFlat: '回复里没有用量时按每张 {price} 计。',
        priceNoUsageManual: '回复里没有用量时按你填的 {price} / 张计。',
        priceNoUsageBlank: '回复里没有用量时费用留空。',
        catalogNear: '{name}（最接近的条目）',
        catalogStatus: '{catalog} 价目表：{n} 个生图模型，{date} 更新。',
        catalogLoading: '正在下载 {catalog} 价目表…',
        catalogFailed: '{catalog} 价目表下载失败：{reason}',
        catalogNotYet: '{catalog} 价目表在第一次需要时下载。',
        catalogRefresh: '更新',
        catalogRetry: '下载',
        statsTotal: '已生成 {n} 张',
        statsNoCost: '没有费用记录',
        cancel: '取消',
        save: '保存',
        toolTitle: '生图',
        preparing: '准备中…',
        generating: '生成中…',
        loading: '加载中…',
        failed: '这张图没有生成出来。',
        noImage: '没有返回图片。',
        frames: '{n} 帧',
        fromInputs: '基于 {n} 张参考图',
        gifUnverified: '{model} 不一定支持 GIF 素材生成，动图的帧可能对不齐。已知 GPT 系列生图模型（gpt-image-*）可以。',
        gifModelHint: '该模型不一定支持 GIF 素材生成；已知 GPT 系列生图模型（gpt-image-*）可以。',
        zoomIn: '放大（+ 或滚轮）',
        zoomOut: '缩小（− 或滚轮）',
        zoomReset: '适应屏幕（0）',
        enlarge: '放大',
        download: '下载',
        more: '更多',
        copyPrompt: '复制提示词',
        delete: '从图库移除',
        close: '关闭',
        next: '下一张',
        previous: '上一张',
        viewer: '图片查看',
        openSession: '打开所属会话',
        openSessionTitled: '打开画这张图的会话：{title}',
        sessionArchived: '这张图所属的会话已归档，取消归档后才能打开。',
        sessionGone: '这张图所属的会话已不存在。',
        unarchiveAndOpen: '取消归档并打开',
        unarchiving: '正在取消归档…',
        unarchiveFailed: '没能取消归档，请到侧边栏里手动取消。',
        refresh: '刷新',
        loadMore: '加载更多',
        empty: '还没有图片。在任何会话里让模型画一张——"给我画一张……的海报"——它就会出现在这里，最新的在前。',
        unavailable: '连不上图库。刷新页面，或确认插件已启用。',
        justNow: '刚刚',
        minutesAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        daysAgo: '{n} 天前',
        lang: "zh",
        testedWith: "已在 {models} 上试过",
        withRecipe: "玩法 · {title}",
        tabGallery: "图库",
        tabRecipes: "玩法",
        recipeCount: "{n} 个玩法",
        importRecipe: "导入",
        sources: "订阅源",
        recipeGone: "这个玩法已经不在你的玩法库里了。",
        alreadyMine: "它已经在「我的」里了。",
        imported: "已导入「{title}」到我的玩法。",
        importNotPng: "只有 PNG 图片能带配方；请改为粘贴配方串。",
        importFailed: "导入失败：{reason}",
        actionFailed: "没有成功，请再试一次。",
        savedMine: "已存到我的玩法。",
        view: "查看",
        showOffCopied: "图片已复制，在打开的页面里贴到评论即可。",
        showOffManual: "已打开玩法主页，在评论里附上这张图即可。",
        remix: "做同款",
        saveAsRecipe: "原样存为玩法",
        makeTemplate: '做成玩法模板',
        downloadWithRecipe: "下载（附带配方）",
        showOff: "晒到作品墙",
        cardCredit: "改编自 {repo}",
        cardBy: "分享者 {author}",
        cardFooter: "把这张图拖进 DSH Images「玩法 → 导入」，就能用这个玩法",
        draftUse: "用「{title}」玩法画一张图（recipe: {ref}）。",
        draftRemix: "照这张图的做法再画一张（recipe: {ref}）。",
        draftTemplatePicture: '把图库里的这张图做成一个可以复用的玩法（recipe: {ref}）：用 image_recipes 的 get 读出它的提示词，把值得让人换的部分（画面里的文字、主体、配色、风格细节）改成 {blank} 这样的空，空的名字用英文。每个空写好中英文标签和默认值（默认值取这张图里的），起好标题和简介，尺寸、帧数和参考图照原样保留，再用 image_recipes 的 save 存到我的玩法，fromImage 填 "{id}"，用这张图当封面。',
        draftTemplateMine: '给我的玩法「{title}」加上可填的空（recipe: {ref}）：用 image_recipes 的 get 读出它，把值得让人换的部分（画面里的文字、主体、配色、风格细节）改成 {blank} 这样的空，空的名字用英文。每个空写好中英文标签和默认值（默认值取现在的写法），再用 image_recipes 的 update 改好这个玩法。',
        templateStarted: '已在「图片」工作区新开对话：按发送，模型会挑出可填的空，做好的模板在「玩法 → 我的」里。',
        shareNoBlanks: '这个玩法没有可填的空，别人只能原样再画这一张。可以先让模型挑出值得换的部分（画面里的字、主体、配色），做成模板再分享。',
        makeTemplateFirst: '先做成模板',
        colon: "：",
        draftChange: "要改的：{text}",
        draftExtra: "另外：{text}",
        draftAttach: "参考图已附上：{list}。",
        listSep: "；",
        remixTitle: "做同款",
        inputN: "参考图 {n}",
        badgePhoto: "需照片",
        originMine: "我的",
        originCommunity: "社区",
        votes: "{n} 👍",
        usedTimes: "用过 {n} 次",
        recipesUnavailable: "连不上玩法库。刷新页面，或确认插件已启用。",
        originAll: "全部",
        originBuiltin: "内置",
        recipesNoMatch: "没有匹配的玩法。",
        mineEmpty: "还没有自己的玩法。在图库里点图片的「⋯ → 存为玩法」，或者导入别人分享给你的配方。",
        communityUnreachable: "社区源暂时连不上（{reason}）。",
        communityEmpty: "社区里还没有玩法，分享一个你的，做第一个吧。",
        recipesEmpty: "没有玩法。",
        recipeSearch: "搜索玩法",
        catAll: "全部",
        cat_photo: "照片变身",
        cat_handdrawn: "手绘",
        cat_editorial: "杂志海报",
        cat_infographic: "信息图",
        cat_3d: "3D",
        cat_sticker: "贴纸动图",
        cat_illustration: "插画",
        cat_product: "产品",
        cat_comic: "漫画",
        draftStarted: "已在「图片」工作区新开对话，配方在输入框里，按发送即可。",
        draftStartedAttach: "已在「图片」工作区新开对话：先在输入框里附上图片，再发送。",
        draftCopied: "消息已复制，粘贴到任意对话里即可。",
        codeCopied: "配方串已复制，发给任何用 DSH Images 的人都能用。",
        cardSaved: "分享卡已保存，图片里带着配方。",
        recipeDeleted: "玩法已删除。",
        editFailed: "保存失败：{reason}",
        recipeSaved: "玩法已保存。",
        creditFrom: "来源：",
        sharedBy: "分享者 {author}",
        worksWall: "作品墙（{n}）",
        editTitle: "标题",
        editSummary: "简介",
        editCategory: "分类",
        editPrompt: "提示词模板",
        editPromptHint: "用 {{名字}} 写一个让用户填的空（名字用英文字母），并在下面给每个空一个默认值。",
        editSlotLabel: "空 {name} 的名称",
        editSlotDefault: "默认值",
        shareIntro: "这会在 GitHub 的社区仓库里新开一个 issue，配方已经填好。审核通过后，所有订阅社区源的人都能看到它。",
        sharePrivacy: "公开分享的内容就是上面这些：标题、简介、提示词和参数。你的照片和对话不会被分享。",
        shareCover: "GitHub 不能通过链接带图片，所以点「打开 GitHub」时会把封面复制到剪贴板：在 issue 的「封面」栏里粘贴（⌘V，Windows 用 Ctrl+V）就行。也可以在这里下载封面再拖进去。",
        shareNoCover: "这个玩法还没有封面：把一张用它画的图拖进 issue 的「封面」栏。",
        shareTitle: "分享玩法",
        shareTo: "分享到",
        shareLive: "提交即上架",
        shareReviewed: "审核后上架",
        shareIntroOpen: "这会在「{name}」里新开一个 issue，配方已经填好。提交后，订阅这个仓库的人就能在「玩法」里看到它，不用审核。想修改就编辑这个 issue，想下架就关掉它。",
        sharePrivacyOpen: "能打开这个仓库的人都能看到上面这些：标题、简介、提示词和参数。你的照片和对话不会被分享。",
        shareCoverOpen: "GitHub 不能通过链接带图片，所以点「打开 GitHub」时会把封面复制到剪贴板：在 issue 的「封面」下面粘贴（⌘V，Windows 用 Ctrl+V）就行。issue 里的第一张图就是封面。",
        shareNoCoverOpen: "这个玩法还没有封面：把一张用它画的图拖进 issue 里。issue 里的第一张图就是封面。",
        needsInputs: "需要你的 {n} 张图",
        needsInputsHint: "发送前在输入框里附上。",
        slotDefault: "默认：{value}",
        remixChange: "想改什么",
        extraWish: "还想要什么（可选）",
        remixChangeHint: "比如换个主角、换一套配色",
        extraWishHint: "比如暖一点的配色、加一行标题",
        hidePrompt: "收起提示词",
        showPrompt: "查看提示词",
        back: "返回",
        downloadCover: "下载封面",
        openGitHub: "打开 GitHub",
        shareOpened: "已打开 GitHub，确认无误后在那里提交。",
        shareOpenedPaste: "已打开 GitHub，封面已复制：在「封面」下面粘贴，再提交。",
        fillCover: '缺封面 · 补上',
        fillCoverTip: '这是你分享的玩法，issue 里还没有封面。点一下会复制封面并打开 issue：在正文右上角点 ··· → Edit，粘贴到「封面」下面再保存。',
        fillCoverNote: '这是你分享的玩法，issue 里还没有封面。「补封面」会复制封面并打开 issue：在正文右上角点 ··· → Edit，粘贴到「封面」下面再保存。',
        fillCoverButton: '补封面',
        fillCoverCopied: '已打开 issue，封面已复制：点 ··· → Edit，粘贴到「封面」下面，再保存。',
        fillCoverSaved: '已打开 issue，封面已下载：点 ··· → Edit，把它拖到「封面」下面，再保存。',
        copyCode: "复制配方串",
        shareCard: "分享卡",
        shareCommunity: "分享到…",
        saveToMine: "存到我的",
        edit: "编辑",
        confirmDelete: "再点一次确认删除",
        deleteRecipe: "删除",
        startRecipe: "用它开始创作",
        copyDraft: "复制消息",
        editRecipe: "编辑玩法",
        importTitle: "导入玩法",
        importDo: "导入",
        importPaste: "粘贴配方串，或者带着配方串的整段消息",
        importPicture: "或者选一张带配方的图片",
        importPictureHint: "分享卡，或用「下载（附带配方）」保存的图片。也可以直接拖到「玩法」页的任意位置。",
        sourcesTitle: "玩法订阅源",
        communityHome: "GitHub 上的社区",
        refreshSources: "刷新",
        sourcesHint: "订阅源可以是一个 GitHub 仓库，它打开着的 issue 就是它的玩法（公司内网的 GitHub 每十分钟读取一次，github.com 每小时一次）；也可以是网上的一份玩法索引（Images 配方格式的 JSON 文件，每周读取一次）。谁都可以给团队办一个：建一个开着 issue 的 public 仓库就行。",
        sourcePlaceholder: "仓库地址，或 https://…/index.json",
        sourceIssues: "· issue 即玩法",
        sourcesNone: "没有订阅源：只显示内置玩法和你自己的。",
        communityDefault: "DSH Images 社区",
        removeSource: "移除",
        sourceError: "连不上：{reason}",
        sourceStatus: "{n} 个玩法 · {when} 更新",
        addSource: "添加",
        restoreDefault: "把 DSH Images 社区源加回来",
      },
    };

    /** The English dictionary, for a seat that brought no `t`. */
    function fallbackT(key, params) {
      const template = DICTIONARY.en[key] ?? key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
    }

    /**
     * Whether the conversation `id` can be opened, from the Harness's Session list
     * and Workspace snapshots, as `{state, archived}`: 'archived' when it, or the
     * session a subagent of it ran under, is archived (`archived` names which);
     * 'gone' when the list no longer has it; 'unknown' while either list is still
     * loading or missing; else 'available'.
     */
    function sessionState(id, sessions, workspaces) {
      if (!id || !sessions || !workspaces || workspaces.state === 'error') return { state: 'unknown' };
      if (sessions.phase === 'pending' || workspaces.phase === 'pending') return { state: 'unknown' };
      const archived = new Set(Array.isArray(workspaces.archivedSessionIds) ? workspaces.archivedSessionIds : []);
      const byId = sessions.byId && typeof sessions.byId === 'object' ? sessions.byId : {};
      // A subagent's own id is never archived; its parent's is.
      for (let at = id, hops = 0; at && hops < 16; hops += 1) {
        if (archived.has(at)) return { state: 'archived', archived: at };
        const row = byId[at];
        at = row?.origin === 'subagent' ? row.parentId : undefined;
      }
      const listed = (Array.isArray(sessions.ids) && sessions.ids.includes(id)) || byId[id] !== undefined;
      return { state: listed ? 'available' : 'gone' };
    }

    /** Show the Images panel in the main column; false where there is none. */
    function openPanel(ctx) {
      try {
        const layout = ctx.get?.('layout');
        if (!layout || typeof layout.selectPanel !== 'function') return false;
        layout.selectPanel(PANEL_ID);
        return true;
      } catch {
        return false;
      }
    }

    // >>> kadaliao-dsh-updates
    // Update reminders shared by every @kadaliao/dsh-* plugin. The canonical copy is shared/updates.js in
    // kadaliao/dsh-plugins, and `node scripts/sync-updates.mjs` there writes it into each plugin's client.js:
    // edit it there, not here.
    //
    // Each plugin checks only itself, and only when it is opened. `opens(View)` wraps the plugin's own view (its
    // panel, Prompt EN's vocabulary tab); mounting that view asks Harness's plugin manager whether a newer version
    // is out (`listVersions`, the same check as its Plugins page), and a newer one shows as a bar across the top of
    // the view. Update runs Harness's `updateBundle`: the new version is checked first, and a failed install puts
    // the old one back. Nothing runs on a timer.
    //
    // A plugin that updates itself is removed mid-update, and Harness closes its view with it; its new client half
    // then loads in place. What the update is doing lives on `window.__kadaliaoDshSelfUpdate`, where the copy that
    // comes next finds it, opens the view again (`options.reopen`) and says how it went. Copies of other versions
    // share it, so its shape only grows:
    //   handoff = { phases: { [name]: { step, from, to, requestId, title, icon, reopen, ... } }, listeners: Set<() => void> }
    //
    // `About` is the plugin's version and a link to its repository, for the plugin to put beside its title.
    // `options.version` is the client half's own version (test/updates.test.mjs keeps it equal to package.json);
    // the repository is https://github.com/kadaliao/<package name> unless `options.repo` says otherwise.
    function kadaliaoUpdates(ctx, options) {
      const HANDOFF_KEY = '__kadaliaoDshSelfUpdate';
      const SNOOZE_MS = 24 * 3600e3;
      // A version is offered once it has been public this long: npm can list a version minutes before it serves the tarball.
      const SETTLE_MS = 10 * 60e3;
      // Opening the view again this soon reuses the last answer instead of asking the registry again.
      const REUSE_MS = 60e3;
      const DONE_HIDE_MS = 15e3;
      const ACTIVE = new Set(['checking', 'removing', 'installing', 'restoring']);
      const React = options.React;
      const h = React.createElement;
      const { useEffect, useState } = React;
      const self = String(options.name);
      const STORE_KEY = `kadaliao-dsh-update:${self}`;
      const VERSION = typeof options.version === 'string' ? options.version : '';
      const REPO = typeof options.repo === 'string' && options.repo !== ''
        ? options.repo
        : `https://github.com/kadaliao/${self.replace(/^@[^/]+\//, '')}`;
      const now = typeof options.now === 'function' ? options.now : () => Date.now();
      const g = typeof window === 'object' && window !== null ? window : globalThis;

      const DICTIONARY = {
        en: {
          title: '{name} {version} is available',
          versions: '{from} → {to}',
          released: 'released {date}',
          update: 'Update',
          retry: 'Try again',
          later: 'Later',
          skip: 'Skip this version',
          close: 'Close',
          details: 'Open in Plugins',
          checking: 'Checking {version}…',
          removing: 'Removing {version}…',
          installing: 'Installing {version}…',
          restoring: 'Putting {version} back…',
          reloads: '{name} closes while it updates and opens again once the new version is in.',
          done: '{name} is updated to {version}.',
          doneRestart: '{name} is updated to {version}. Restart DeepSeek Harness to use it.',
          failed: 'Not updated: {reason}',
          failedRestored: 'Not updated, {version} is back: {reason}',
          failedRemoved: 'Not updated, and {version} could not be put back. Install it again from Plugins.',
          unknown: 'No answer from Harness; check Plugins to see which version is installed.',
          aboutVersion: 'Version {version}',
          aboutSource: 'Source code on GitHub',
        },
        zh: {
          title: '{name} 有新版本 {version}',
          versions: '{from} → {to}',
          released: '{date} 发布',
          update: '更新',
          retry: '再试一次',
          later: '稍后',
          skip: '跳过此版本',
          close: '关闭',
          details: '在插件页查看',
          checking: '正在检查 {version}…',
          removing: '正在移除 {version}…',
          installing: '正在安装 {version}…',
          restoring: '正在装回 {version}…',
          reloads: '更新时{name}会先关闭，装好后自动重新打开。',
          done: '{name} 已更新到 {version}。',
          doneRestart: '{name} 已更新到 {version}，重启 DeepSeek Harness 后生效。',
          failed: '没有更新：{reason}',
          failedRestored: '没有更新，已装回 {version}：{reason}',
          failedRemoved: '没有更新，{version} 也没能装回。请到「插件」里重新安装。',
          unknown: 'Harness 没有回音，请到「插件」里看看装的是哪个版本。',
          aboutVersion: '版本 {version}',
          aboutSource: '在 GitHub 上查看源码',
        },
      };

      // The words stay out of the plugin's own dictionary: Harness's locale picks between two strings, which says the language.
      function language() {
        try {
          if (typeof ctx.locale?.resolveText === 'function') {
            const lang = ctx.locale.resolveText({ en: 'en', zh: 'zh' });
            if (lang === 'zh' || lang === 'en') return lang;
          }
        } catch {
          // The page's language below.
        }
        const lang = String(g.document?.documentElement?.lang || g.navigator?.language || 'en').toLowerCase();
        return lang.startsWith('zh') ? 'zh' : 'en';
      }

      function say(key, params) {
        const template = DICTIONARY[language()][key] ?? DICTIONARY.en[key] ?? key;
        return params ? template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '')) : template;
      }

      // --- what this copy knows, and what outlives it ---------------------------------------------

      /** This copy's own view of the plugin: the Remote it may use, the last offer, and whether the view is open. */
      const local = { remote: null, offer: null, checking: false, checkedAt: 0, viewing: 0 };
      const renders = new Set();

      const handoff = (() => {
        let current = g[HANDOFF_KEY];
        if (current === null || typeof current !== 'object' || current.phases === null || typeof current.phases !== 'object') {
          current = { phases: {}, listeners: new Set() };
          try {
            g[HANDOFF_KEY] = current;
          } catch {
            // A frozen global keeps the update to this copy.
          }
        }
        if (!(current.listeners instanceof Set)) current.listeners = new Set();
        return current;
      })();

      function notify() {
        for (const render of [...renders]) {
          try {
            render();
          } catch {
            // One view failing leaves the others.
          }
        }
      }

      /** Every copy alive redraws: an update a removed copy started ends in the copy that replaced it. */
      function emit() {
        for (const listener of [...handoff.listeners]) {
          try {
            listener();
          } catch {
            // As above.
          }
        }
        if (!handoff.listeners.has(notify)) notify();
      }

      function phaseOf() {
        const phase = handoff.phases[self];
        return phase !== null && typeof phase === 'object' ? phase : undefined;
      }

      function setPhase(phase) {
        if (phase === undefined) delete handoff.phases[self];
        else handoff.phases[self] = phase;
        emit();
      }

      // --- what this browser remembers -------------------------------------------------------------

      function emptyStore() {
        return { v: 1, snoozed: null, snoozedUntil: 0, skipped: null };
      }

      function readStore() {
        try {
          const raw = g.localStorage?.getItem(STORE_KEY);
          const value = raw ? JSON.parse(raw) : null;
          if (value !== null && typeof value === 'object' && value.v === 1) return { ...emptyStore(), ...value };
        } catch {
          // A private window or a blocked store remembers nothing.
        }
        return emptyStore();
      }

      function writeStore(change) {
        const next = { ...readStore(), ...change, v: 1 };
        try {
          g.localStorage?.setItem(STORE_KEY, JSON.stringify(next));
        } catch {
          // As above.
        }
        return next;
      }

      // --- reading Harness's answers ---------------------------------------------------------------

      function messageOf(error) {
        if (error instanceof Error) return error.message;
        return typeof error === 'string' ? error : 'unknown error';
      }

      /** A Remote answer `{ ok, value }` or `{ ok: false, error }`; a bare value passes through. */
      function unwrap(answer) {
        if (answer !== null && typeof answer === 'object' && typeof answer.ok === 'boolean') {
          return answer.ok ? { ok: true, value: answer.value } : { ok: false, message: answer.error?.message ?? 'refused' };
        }
        return { ok: true, value: answer };
      }

      async function call(remote, method, ...args) {
        try {
          const fn = remote?.pluginManager?.[method];
          if (typeof fn !== 'function') return { ok: false, message: `pluginManager.${method} is missing` };
          return unwrap(await fn.apply(remote.pluginManager, args));
        } catch (error) {
          return { ok: false, message: messageOf(error) };
        }
      }

      function installable(version) {
        return version !== null && typeof version === 'object' && typeof version.version === 'string'
          && version.bundle === true && version.incompatible === undefined && version.deprecated === undefined && version.prerelease !== true;
      }

      function settled(version, at) {
        const published = typeof version.publishedAt === 'string' ? Date.parse(version.publishedAt) : NaN;
        return !Number.isFinite(published) || published + SETTLE_MS <= at;
      }

      /** The newest version worth offering from a listing (newest first, all newer than the installed one). */
      function choose(list, at) {
        if (list === null || typeof list !== 'object' || list.status !== 'listed' || !Array.isArray(list.versions)) return undefined;
        return list.versions.find((version) => installable(version) && settled(version, at));
      }

      /** This plugin as Harness lists it: null when the list could not be read, undefined when it is not there. */
      async function mine(remote) {
        const answer = await call(remote, 'listBundles');
        if (!answer.ok || !Array.isArray(answer.value)) return null;
        return answer.value.find((bundle) => bundle !== null && typeof bundle === 'object' && bundle.name === self && bundle.installed !== false);
      }

      /** What is installed settles an update whose answer was lost, and retires an offer another surface applied. */
      function settleWith(bundle) {
        const version = typeof bundle?.version === 'string' ? bundle.version : undefined;
        const phase = phaseOf();
        if (phase !== undefined && (ACTIVE.has(phase.step) || phase.step === 'unknown') && version === phase.to) setPhase({ ...phase, step: 'done' });
        if (local.offer !== null && local.offer.installed !== version) {
          local.offer = null;
          local.checkedAt = 0;
        }
      }

      async function check(remote) {
        if (local.checking) return;
        local.checking = true;
        try {
          const bundle = await mine(remote);
          // An unreadable list is asked again the next time the view opens.
          if (bundle === null) return;
          settleWith(bundle);
          // Only a copy installed from a registry and switched on is offered updates; a folder or Git install is not.
          if (bundle === undefined || bundle.update !== 'registry' || bundle.enabled === false || typeof bundle.version !== 'string') {
            local.offer = null;
            local.checkedAt = now();
            return;
          }
          const answer = await call(remote, 'listVersions', self, {});
          if (!answer.ok || answer.value?.status !== 'listed') return;
          const chosen = choose(answer.value, now());
          local.offer = chosen === undefined
            ? null
            : {
              name: self,
              title: bundle.meta?.title ?? null,
              icon: typeof bundle.meta?.icon === 'string' ? bundle.meta.icon : null,
              installed: typeof answer.value.installed === 'string' ? answer.value.installed : bundle.version,
              version: chosen.version,
              publishedAt: typeof chosen.publishedAt === 'string' ? chosen.publishedAt : null,
              registry: answer.value.registry === undefined ? null : answer.value.registry,
            };
          local.checkedAt = now();
        } finally {
          local.checking = false;
          emit();
        }
      }

      /** Ask again when the view is open and the last answer is older than a minute. */
      function maybeCheck() {
        if (local.remote === null || local.viewing === 0 || local.checking || now() - local.checkedAt < REUSE_MS) return;
        void check(local.remote).catch(() => {});
      }

      async function revalidate(remote) {
        const bundle = await mine(remote);
        if (bundle === null) return;
        settleWith(bundle);
        emit();
        maybeCheck();
      }

      /** The view opened: check, and return what closing it does. */
      function opened() {
        local.viewing += 1;
        maybeCheck();
        let open = true;
        return () => {
          if (!open) return;
          open = false;
          local.viewing = Math.max(0, local.viewing - 1);
        };
      }

      function uuid() {
        try {
          if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID();
        } catch {
          // An insecure context has no randomUUID.
        }
        const bytes = new Uint8Array(16);
        try {
          g.crypto.getRandomValues(bytes);
        } catch {
          for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }

      function isApplied(result) {
        const application = result?.application;
        return application === 'applied' || application === 'overridden' || application === 'restart-required';
      }

      /** How an update ended, as the bar says it. */
      function outcomeOf(answer, from) {
        if (!answer.ok) return { step: 'unknown', reason: answer.message };
        const value = answer.value ?? {};
        const result = value.result ?? {};
        if (isApplied(result)) return { step: 'done', restart: result.application === 'restart-required' };
        const reason = String(result.error?.diagnostic || result.error?.code || result.application || 'failed').trim();
        if (value.restore === undefined) return { step: 'failed', reason, kept: true };
        if (isApplied(value.restore)) return { step: 'failed', reason, restored: true, from };
        return { step: 'failed', reason, removed: true, from };
      }

      async function update() {
        const remote = local.remote;
        const offer = local.offer;
        const phase = phaseOf();
        if (remote === null || offer === null || (phase !== undefined && (ACTIVE.has(phase.step) || phase.step === 'done'))) return;
        const requestId = uuid();
        // Harness closes the view when it removes this version; the copy that comes next opens it again.
        setPhase({ step: 'checking', from: offer.installed, to: offer.version, requestId, title: offer.title, icon: offer.icon, reopen: local.viewing > 0 });
        const answer = await call(remote, 'updateBundle', self, offer.version, { registry: offer.registry, requestId });
        const outcome = outcomeOf(answer, offer.installed);
        const current = phaseOf();
        // Closed meanwhile, or a lost answer arriving after what is installed already said it worked.
        if (current?.requestId !== requestId || (outcome.step === 'unknown' && current.step === 'done')) return;
        setPhase({ ...current, ...outcome });
        if (outcome.step === 'done' && local.offer?.version === offer.version) local.offer = null;
        // A lost answer is settled by what is installed now.
        if (outcome.step === 'unknown' && local.remote !== null) await revalidate(local.remote);
      }

      function progress(event) {
        const phase = phaseOf();
        if (event === null || typeof event !== 'object' || typeof event.step !== 'string' || phase === undefined) return;
        if (phase.requestId === event.requestId && ACTIVE.has(phase.step)) setPhase({ ...phase, step: event.step });
      }

      /** What the bar shows, if anything. */
      function shown() {
        const phase = phaseOf();
        if (phase !== undefined) return { phase, offer: local.offer };
        const offer = local.offer;
        if (offer === null) return null;
        const store = readStore();
        if (store.skipped === offer.version) return null;
        if (store.snoozed === offer.version && now() < store.snoozedUntil) return null;
        return { phase: undefined, offer };
      }

      /** Forget how the last update ended; one still running stays. */
      function close() {
        const phase = phaseOf();
        if (phase === undefined || ACTIVE.has(phase.step)) return;
        if (phase.step === 'done' && local.offer?.version === phase.to) local.offer = null;
        setPhase(undefined);
      }

      function later() {
        const view = shown();
        if (view === null || (view.phase !== undefined && ACTIVE.has(view.phase.step))) return;
        close();
        if (view.offer !== null) writeStore({ snoozed: view.offer.version, snoozedUntil: now() + SNOOZE_MS });
        emit();
      }

      function skip() {
        const view = shown();
        if (view === null || view.offer === null || (view.phase !== undefined && ACTIVE.has(view.phase.step))) return;
        close();
        writeStore({ skipped: view.offer.version });
        emit();
      }

      // --- the bar ---------------------------------------------------------------------------------

      const C = {
        tint: 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 8%, var(--dsw-alias-bg-layer-1, #fff))',
        border: 'var(--dsw-alias-border-l1, rgba(0,0,0,.08))',
        primary: 'var(--dsw-alias-label-primary, #1f2329)',
        muted: 'var(--dsw-alias-label-secondary, #646a73)',
        faint: 'var(--dsw-alias-label-tertiary, #8f959e)',
        brand: 'var(--dsw-alias-brand-primary, #4d6bfe)',
        onBrand: 'var(--dsw-alias-label-primary-foreground, #fff)',
        ok: 'var(--dsw-alias-state-success-primary, #2ea121)',
        error: 'var(--dsw-alias-state-error-primary, #d83931)',
      };

      function titleOf(title) {
        if (title !== null && title !== undefined) {
          try {
            if (typeof ctx.locale?.resolveText === 'function') {
              const text = ctx.locale.resolveText(title);
              if (typeof text === 'string' && text !== '') return text;
            }
          } catch {
            // The fallback below.
          }
          if (typeof title === 'string') return title;
          if (typeof title === 'object') return title[language()] ?? title.en ?? self;
        }
        return self.replace(/^@kadaliao\/dsh-/, '');
      }

      function day(iso) {
        const at = typeof iso === 'string' ? new Date(iso) : null;
        if (at === null || Number.isNaN(at.getTime())) return null;
        const pad = (n) => String(n).padStart(2, '0');
        return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
      }

      /** The line of a pnpm log that says what went wrong, else its last line, kept short; the whole log goes in the tooltip. */
      function headline(text) {
        const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const line = lines.find((l) => /\bERR_[A-Z0-9_]+|\bERR!|\berror\b/i.test(l)) ?? lines.at(-1) ?? '';
        return line.length > 160 ? `${line.slice(0, 157)}…` : line;
      }

      function Btn({ kind, onClick, children, label }) {
        const primary = kind === 'update';
        return h(
          'button',
          {
            type: 'button',
            onClick,
            'aria-label': label,
            title: label,
            'data-kadaliao-update-action': kind,
            style: {
              font: 'inherit',
              fontSize: 12,
              lineHeight: '18px',
              padding: primary ? '3px 10px' : '3px 6px',
              borderRadius: 6,
              border: 0,
              background: primary ? C.brand : 'transparent',
              color: primary ? C.onBrand : C.muted,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            },
          },
          children,
        );
      }

      /** The bar's two lines: what it is about, and the detail under it. */
      function lines(view, name) {
        const { phase, offer } = view;
        const to = phase?.to ?? offer?.version;
        const date = offer === null ? null : day(offer.publishedAt);
        const meta = offer === null ? null : [say('versions', { from: offer.installed, to: offer.version }), date === null ? null : say('released', { date })].filter(Boolean).join(' · ');
        if (phase === undefined) return { head: say('title', { name, version: to }), detail: meta, tone: 'muted' };
        if (ACTIVE.has(phase.step)) {
          const version = phase.step === 'restoring' || phase.step === 'removing' ? phase.from : phase.to;
          return { head: say(phase.step, { version }), detail: say('reloads', { name }), tone: 'muted' };
        }
        if (phase.step === 'done') return { head: say(phase.restart ? 'doneRestart' : 'done', { name, version: phase.to }), detail: null, tone: 'ok' };
        const head = say('title', { name, version: to });
        if (phase.step === 'unknown') return { head, detail: say('unknown'), tone: 'error', full: phase.reason };
        if (phase.removed) return { head, detail: say('failedRemoved', { version: phase.from }), tone: 'error', full: phase.reason };
        if (phase.restored) return { head, detail: say('failedRestored', { version: phase.from, reason: headline(phase.reason) }), tone: 'error', full: phase.reason };
        return { head, detail: say('failed', { reason: headline(phase.reason) }), tone: 'error', full: phase.reason };
      }

      function Bar() {
        const [, setTick] = useState(0);
        useEffect(() => {
          const render = () => setTick((n) => n + 1);
          renders.add(render);
          return () => {
            renders.delete(render);
          };
        }, []);
        const view = shown();
        const done = view?.phase?.step === 'done';
        useEffect(() => {
          if (!done) return undefined;
          const timer = setTimeout(close, DONE_HIDE_MS);
          return () => clearTimeout(timer);
        }, [done]);
        if (view === null) return null;
        const { phase, offer } = view;
        const name = titleOf(phase?.title ?? offer?.title);
        const icon = phase?.icon ?? offer?.icon ?? null;
        const busy = phase !== undefined && ACTIVE.has(phase.step);
        const text = lines(view, name);
        const navigation = (() => {
          try {
            const face = ctx.get?.('pluginNavigation');
            return typeof face?.openBundle === 'function' ? face : null;
          } catch {
            return null;
          }
        })();
        const canUpdate = offer !== null && (phase === undefined || phase.step === 'failed' || phase.step === 'unknown');
        const buttons = busy
          ? []
          : done
            ? [h(Btn, { key: 'close', kind: 'close', onClick: close, label: say('close') }, '×')]
            : [
              canUpdate ? h(Btn, { key: 'update', kind: 'update', onClick: () => void update(), label: say(phase === undefined ? 'update' : 'retry') }, say(phase === undefined ? 'update' : 'retry')) : null,
              h(Btn, { key: 'later', kind: 'later', onClick: later, label: say('later') }, say('later')),
              offer !== null ? h(Btn, { key: 'skip', kind: 'skip', onClick: skip, label: say('skip') }, say('skip')) : null,
            ].filter(Boolean);
        return h(
          'div',
          {
            role: 'status',
            'aria-live': 'polite',
            'data-kadaliao-update': phase?.step ?? 'offer',
            style: {
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px 10px',
              padding: '8px 12px',
              background: C.tint,
              borderBottom: `1px solid ${C.border}`,
              color: C.primary,
              fontSize: 13,
              lineHeight: '18px',
              flexShrink: 0,
              boxSizing: 'border-box',
            },
          },
          icon ? h('img', { src: icon, alt: '', width: 20, height: 20, style: { width: 20, height: 20, borderRadius: 5, flexShrink: 0, objectFit: 'cover' } }) : null,
          h(
            'div',
            { style: { flex: '1 1 180px', minWidth: 0 } },
            h(
              navigation ? 'button' : 'div',
              navigation
                ? {
                  type: 'button',
                  title: say('details'),
                  onClick: () => navigation.openBundle(self),
                  style: { font: 'inherit', fontWeight: 600, color: text.tone === 'ok' ? C.ok : C.primary, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' },
                }
                : { style: { fontWeight: 600, color: text.tone === 'ok' ? C.ok : C.primary } },
              text.head,
            ),
            text.detail === null
              ? null
              : h(
                'div',
                {
                  'data-kadaliao-update-detail': '',
                  title: text.full ?? undefined,
                  style: { fontSize: 12, marginTop: 1, color: text.tone === 'error' ? C.error : C.muted, overflowWrap: 'anywhere' },
                },
                text.detail,
              ),
          ),
          buttons.length === 0 ? null : h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto' } }, buttons),
        );
      }

      const FRAME = { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, minWidth: 0 };
      const BODY = { flex: '1 1 0%', minHeight: 0, minWidth: 0, position: 'relative' };

      /** The plugin's own view, with the bar above it; opening it is what checks. The frame never changes shape, so the view is not remounted when the bar comes and goes. */
      function opens(View) {
        if (View === null || View === undefined) return View;
        return function KadaliaoUpdateFrame(props) {
          useEffect(() => opened(), []);
          return h('div', { 'data-kadaliao-update-frame': self, style: FRAME }, h(Bar, null), h('div', { style: BODY }, h(View, props)));
        };
      }

      // --- version and repository -------------------------------------------------------------------

      // GitHub's mark (Octicons mark-github), drawn in the text colour.
      const GITHUB_MARK = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

      /** The plugin's version and a GitHub mark linking to its repository, small and muted; `style` overrides the colour or spacing. */
      function About(props) {
        const style = props?.style ?? null;
        const size = typeof props?.size === 'number' ? props.size : 14;
        return h(
          'span',
          {
            'data-kadaliao-about': self,
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 12, lineHeight: '16px', fontWeight: 400, color: C.faint, whiteSpace: 'nowrap', ...style },
          },
          VERSION === ''
            ? null
            : h('span', { 'data-kadaliao-version': VERSION, title: say('aboutVersion', { version: VERSION }), style: { fontVariantNumeric: 'tabular-nums', userSelect: 'text' } }, `v${VERSION}`),
          h(
            'a',
            {
              href: REPO,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: say('aboutSource'),
              'aria-label': say('aboutSource'),
              'data-kadaliao-repo': REPO,
              onClick: (event) => event?.stopPropagation?.(),
              style: { display: 'inline-flex', alignItems: 'center', color: 'inherit', padding: 2, margin: -2, borderRadius: 4, textDecoration: 'none' },
            },
            h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true', style: { display: 'block' } }, h('path', { d: GITHUB_MARK })),
          ),
        );
      }

      // --- joining ---------------------------------------------------------------------------------

      const api = { opens, opened, check, update, later, skip, close, shown, readStore, choose, outcomeOf, headline, local, handoff, About, version: VERSION, repo: REPO };
      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          handoff.listeners.add(notify);
          return () => {
            handoff.listeners.delete(notify);
          };
        }, `${self}: update handoff`);
      } else {
        handoff.listeners.add(notify);
      }
      if (typeof ctx.inject !== 'function') return api;
      const join = (scope) => {
        const remote = scope.remote;
        if (remote === null || typeof remote !== 'object' || typeof remote.pluginManager?.listBundles !== 'function') return undefined;
        const offs = [];
        const listen = (event, fn) => {
          try {
            const off = remote.$on?.(event, fn);
            if (typeof off === 'function') offs.push(off);
          } catch {
            // A Remote without events still checks when the view opens.
          }
        };
        local.remote = remote;
        listen('plugin-manager/changed', () => void revalidate(remote).catch(() => {}));
        listen('plugin-manager/update-state', progress);
        // A copy that replaced one mid-update opens the view Harness closed and reads how it went; a view already open checks now.
        const phase = phaseOf();
        if (phase !== undefined) {
          if (phase.reopen === true) {
            setPhase({ ...phase, reopen: false });
            // After apply(ctx) has registered the view, which may still be running when this joins.
            void Promise.resolve()
              .then(() => {
                if (typeof options.reopen === 'function') options.reopen();
              })
              .catch(() => {
                // The view stays closed; the bar shows the next time it opens.
              });
          }
          void revalidate(remote).catch(() => {});
        } else {
          maybeCheck();
        }
        emit();
        return () => {
          for (const off of offs.splice(0)) {
            try {
              off();
            } catch {
              // Already gone.
            }
          }
          if (local.remote === remote) local.remote = null;
          emit();
        };
      };
      ctx.inject(['remote', 'remote.pluginManager', 'remoteAccess'], (scope) => {
        const access = scope.remoteAccess;
        if (access !== null && typeof access === 'object' && typeof access.whenAccess === 'function') {
          // Only a Peer that may update plugins is told about updates; the owner always may.
          return access.whenAccess('pluginManager/updateBundle', () => join(scope) ?? (() => {}));
        }
        return join(scope);
      });
      return api;
    }
    // <<< kadaliao-dsh-updates

    return {
      inject: ['slots', 'locale', 'uiConversation'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARY), 'images: dictionaries');
        // This plugin's update reminder, checked when its own view opens (see the block above).
        const updates = kadaliaoUpdates(ctx, { React, name: '@kadaliao/dsh-images', version: VERSION, reopen: () => openPanel(ctx) });
        About = updates.About;
        let bound = null;
        const tr = (key, params) => {
          try {
            if (bound === null && typeof ctx.locale.bind === 'function') bound = ctx.locale.bind(NS);
            if (typeof bound === 'function') return bound(key, params);
          } catch {
            // The English below.
          }
          return fallbackT(key, params);
        };
        const withT = (Component, extra) => (props) => h(Component, { ...props, ...extra, t: typeof props.t === 'function' ? props.t : tr });

        // The gallery's way back to a picture's conversation, through the sidebar's own
        // navigation. Read on use: a Harness without it shows no button.
        const service = (name) => {
          try {
            return ctx.get?.(name);
          } catch {
            return undefined;
          }
        };
        const snapshot = (name) => {
          try {
            return service(name)?.list?.getSnapshot?.();
          } catch {
            return undefined;
          }
        };
        const sessions = {
          available: () => typeof service('uiWorkspace')?.openSession === 'function',
          state: (id) => sessionState(id, snapshot('sessions'), snapshot('workspaces')),
          title: (id) => {
            const title = snapshot('sessions')?.byId?.[id]?.displayTitle;
            return typeof title === 'string' && title !== id ? title : undefined;
          },
          /** False when the Harness refused it (a session it does not know). */
          open: (id) => {
            try {
              service('uiWorkspace').openSession(id);
              return true;
            } catch {
              return false;
            }
          },
          canUnarchive: () => typeof service('uiWorkspace')?.unarchiveSession === 'function',
          /** Resolves once the archive set no longer has `id`, false when the Host refused. */
          unarchive: (id) =>
            Promise.resolve()
              .then(() => service('uiWorkspace').unarchiveSession(id))
              .then(
                () => true,
                () => false,
              ),
        };

        // The tool's own card in the conversation.
        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register({ name: 'tool.call.toolview', key: TOOL_NAME, locale: NS }, withT(GenerateImageView)),
        );
        // The picture as a row of the conversation, outside the turn's process fold.
        ctx.uiConversation.events.register(imagesResultDefinition);
        ctx.slots.inject('conversation.chat.node', () =>
          ctx.slots.register({ name: 'conversation.chat.node', key: RESULT_KIND, locale: NS }, withT(ImagesResultRow)),
        );
        // The gallery: an icon in the left sidebar's panel row, and the main panel it opens.
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => tr('title') }, ImagesGlyph),
        );
        // A recipe starts a new conversation with its message in the composer, for the user to send,
        // in the Images workspace: without a workspace the Host would pick the one the person is in.
        const samePath = (a, b) => String(a ?? '').replace(/[\\/]+$/, '') === String(b ?? '').replace(/[\\/]+$/, '');
        const imagesWorkspace = async () => {
          const reply = await postJson(WORKSPACE_ROUTE, { title: tr('title') });
          if (!reply?.ok || typeof reply.path !== 'string') return undefined;
          // The page's own list must hold the workspace before a conversation opens in it, and
          // `create` puts it there (it resolves a folder the Host already has).
          const ws = service('workspaces');
          if (typeof ws?.create === 'function') {
            const view = await ws.create({ path: reply.path });
            if (view?.workspaceId) return view.workspaceId;
          }
          const items = snapshot('workspaces')?.items ?? [];
          return items.find((w) => w.workspaceId === reply.workspaceId || samePath(w.path, reply.path))?.workspaceId;
        };
        const drafts = {
          available: () => typeof service('uiWorkspace')?.startSession === 'function',
          /** Resolves false when there is no Images workspace to start in: the sheet copies the message instead. */
          start: async (prompt) => {
            const ui = service('uiWorkspace');
            if (typeof ui?.startSession !== 'function') return false;
            try {
              const workspaceId = await imagesWorkspace();
              if (workspaceId === undefined) return false;
              ui.startSession(workspaceId, { prompt, whenDraftExists: 'replace' });
              return true;
            } catch {
              return false;
            }
          },
        };
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, updates.opens(withT(ImagesPanel, { sessions, drafts }))));
        // A bare `/images` opens the panel.
        if (typeof ctx.inject === 'function') {
          ctx.inject(['commandUi'], (scope) => {
            scope.effect(
              () =>
                scope.commandUi.decorate({
                  name: 'images',
                  available: () => typeof ctx.get?.('layout')?.selectPanel === 'function',
                  ui: { kind: 'action', run: () => void openPanel(ctx) },
                }),
              'images: /images opens the panel',
            );
          });
        }
      },
    };
  },
});
