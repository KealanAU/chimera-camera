// Maps Lynx intrinsic elements onto DOM so the unmodified App.tsx renders in a
// browser: view → div, text → span, image → img, and camera-view → a still photo
// that zooms and mirrors off the same session calls the real preview would get.
import * as R from 'react/jsx-runtime'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { store, subscribe } from './zoom-store.js'
import VIEWFINDER from './viewfinder.jpg'

// Lynx reports touch points in page coordinates; here the page is the phone frame.
function toTouch(e) {
  const r = document.getElementById('phone').getBoundingClientRect()
  const s = r.width / 390
  const p = { clientX: (e.clientX - r.left) / s, clientY: (e.clientY - r.top) / s }
  return { changedTouches: [p], touches: [p] }
}

// `ref.current` is the element's latest props, so a touch that outlives a
// re-render (the zoom dial opening mid-press) reaches the current handlers.
function events(ref) {
  const p = ref.current
  const o = {}
  if (p.bindtap) o.onClick = (e) => ref.current.bindtap?.(e)
  if (p.bindtouchstart || p.bindtouchmove || p.bindtouchend || p.bindtouchcancel) {
    // Like Lynx, a touch keeps reporting to the element it started on. Window
    // listeners rather than pointer capture, which would retarget the click.
    o.onPointerDown = (e) => {
      ref.current.bindtouchstart?.(toTouch(e))
      const move = (ev) => ref.current.bindtouchmove?.(toTouch(ev))
      const end = (ev) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        ;(ev.type === 'pointercancel' ? ref.current.bindtouchcancel : ref.current.bindtouchend)?.(toTouch(ev))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    }
  }
  return o
}

function useLatest(p) {
  const ref = useRef(p)
  ref.current = p
  return ref
}
function View({ style, children, id, ...p }) {
  return R.jsx('div', { id, className: 'lx-view', style, ...events(useLatest(p)), children })
}
function Text({ style, children, ...p }) {
  return R.jsx('span', { className: 'lx-text', style, ...events(useLatest(p)), children })
}
function Img({ src, style, mode }) {
  return R.jsx('img', { src, style: { objectFit: mode === 'aspectFit' ? 'contain' : 'cover', display: 'block', ...style }, draggable: false, alt: '' })
}
function CameraView({ style, bindready, facing }) {
  const s = useSyncExternalStore(subscribe, () => store.factor)
  const ready = useRef(bindready)
  useEffect(() => {
    // An iPhone Pro's lens layout: ultra-wide base, wide at 2×, tele at 6× (display .5 / 1 / 3).
    ready.current?.({ detail: { switchOverZoomFactors: [2, 6], wideFactor: 2, minZoom: 1, maxZoom: 30 } })
  }, [])
  const display = s / 2
  const scale = Math.max(1, 0.85 + 0.3 * display)
  return R.jsx('img', {
    src: VIEWFINDER,
    draggable: false,
    alt: '',
    style: { ...style, objectFit: 'cover', display: 'block', transform: `scale(${scale}) scaleX(${facing === 'front' ? -1 : 1})`, transition: 'transform 250ms cubic-bezier(0.2,0.8,0.2,1)' },
  })
}

const map = { view: View, text: Text, image: Img, 'camera-view': CameraView }
export const Fragment = R.Fragment
export const jsx = (t, p, k) => R.jsx(map[t] ?? t, p, k)
export const jsxs = (t, p, k) => R.jsxs(map[t] ?? t, p, k)
