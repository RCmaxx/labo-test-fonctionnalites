// Contrôle statique : variables non définies (imports oubliés), code mort.
export default [{
  files: ['js/**/*.js'],
  languageOptions: {
    ecmaVersion: 2023, sourceType: 'module',
    globals: Object.fromEntries(['window','document','location','localStorage','navigator','console','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','addEventListener','dispatchEvent','innerWidth','innerHeight','getComputedStyle','Date','URL','FormData','FileReader','Image','Notification','HashChangeEvent','Event','CustomEvent','IntersectionObserver','ResizeObserver','MutationObserver','fetch','alert','confirm','history','crypto','Blob','File','createImageBitmap','matchMedia','structuredClone','visualViewport','screen','Audio','AbortController','queueMicrotask','removeEventListener','CSS','prompt'].map(k => [k, 'readonly'])),
  },
  rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }], 'no-dupe-keys': 'error', 'no-unreachable': 'warn' },
}];
