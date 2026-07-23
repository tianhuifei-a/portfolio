/* ============================================
   杞╁績鍗?路 Design Portfolio
   Main JavaScript
   ============================================ */

'use strict';

// =============================================
// WebGL SideRays
// =============================================

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
};

const originToFlip = (origin) => {
  switch (origin) {
    case 'top-left':     return [1, 0];
    case 'bottom-right': return [0, 1];
    case 'bottom-left':  return [1, 1];
    default:             return [0, 0]; // top-right
  }
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile error: ' + info);
  }
  return shader;
}

function createSideRays(canvas, opts) {
  const options = Object.assign({
    speed: 2.5,
    rayColor1: '#EAB308',
    rayColor2: '#96c8ff',
    intensity: 2,
    spread: 2,
    origin: 'top-right',
    tilt: 0,
    saturation: 1.5,
    blend: 0.75,
    falloff: 1.6,
    opacity: 1.0,
  }, opts);

  // ---- WebGL Setup ----
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  }) || canvas.getContext('experimental-webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    canvas.style.display = 'none';
    return null;
  }

  // ---- Shaders ----
  const vertexSrc = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;

    uniform float iTime;
    uniform vec2  iResolution;
    uniform float iSpeed;
    uniform vec3  iRayColor1;
    uniform vec3  iRayColor2;
    uniform float iIntensity;
    uniform float iSpread;
    uniform float iFlipX;
    uniform float iFlipY;
    uniform float iTilt;
    uniform float iSaturation;
    uniform float iBlend;
    uniform float iFalloff;
    uniform float iOpacity;

    float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
      vec2 sourceToCoord = coord - raySource;
      float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
      return clamp(
        (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
        (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
        0.0, 1.0) *
        clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
      if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

      vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
      vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

      float tiltRad = iTilt * 3.14159265 / 180.0;
      float cs = cos(tiltRad);
      float sn = sin(tiltRad);
      vec2 rel = coord - rayPos;
      vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

      float halfSpread = iSpread * 0.275;
      vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
      vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

      vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
      vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

      vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

      float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
      float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
      color.rgb *= brightness;

      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(gray), color.rgb, iSaturation);

      color.a = max(color.r, max(color.g, color.b)) * iOpacity;
      gl_FragColor = color;
    }
  `;

  // ---- Compile & Link ----
  let program;
  try {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);
  } catch (e) {
    console.warn('SideRays WebGL:', e.message);
    canvas.style.display = 'none';
    return null;
  }

  // ---- Geometry: full-screen quad ----
  const positions = new Float32Array([
    -1, -1,   1, -1,   -1, 1,
     1, -1,   1,  1,   -1, 1,
  ]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // ---- Uniforms ----
  const u = {};
  const names = [
    'iTime', 'iResolution', 'iSpeed',
    'iRayColor1', 'iRayColor2',
    'iIntensity', 'iSpread',
    'iFlipX', 'iFlipY', 'iTilt',
    'iSaturation', 'iBlend', 'iFalloff', 'iOpacity',
  ];
  names.forEach(n => { u[n] = gl.getUniformLocation(program, n); });

  const [flipX, flipY] = originToFlip(options.origin);
  const c1 = hexToRgb(options.rayColor1);
  const c2 = hexToRgb(options.rayColor2);

  function setSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2fv(u.iResolution, [canvas.width, canvas.height]);
  }

  setSize();
  gl.uniform1f(u.iSpeed, options.speed);
  gl.uniform3fv(u.iRayColor1, c1);
  gl.uniform3fv(u.iRayColor2, c2);
  gl.uniform1f(u.iIntensity, options.intensity);
  gl.uniform1f(u.iSpread, options.spread);
  gl.uniform1f(u.iFlipX, flipX);
  gl.uniform1f(u.iFlipY, flipY);
  gl.uniform1f(u.iTilt, options.tilt);
  gl.uniform1f(u.iSaturation, options.saturation);
  gl.uniform1f(u.iBlend, options.blend);
  gl.uniform1f(u.iFalloff, options.falloff);
  gl.uniform1f(u.iOpacity, options.opacity);

  // ---- Render Loop ----
  let animId = null;
  let running = true;

  function loop(time) {
    if (!running) return;
    gl.uniform1f(u.iTime, time * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  // ---- Resize ----
  let resizeTimer = null;
  function onResize() {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(() => {
      if (running) setSize();
    });
  }
  window.addEventListener('resize', onResize);

  // ---- Cleanup ----
  function destroy() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    const loseCtx = gl.getExtension('WEBGL_lose_context');
    if (loseCtx) loseCtx.loseContext();
  }

  return { destroy };
}

// =============================================
// Navigation Scroll Behavior
// =============================================

const nav = document.getElementById('navbar');
const scrollIndicator = document.getElementById('scrollIndicator');
let lastScrollY = 0;
let ticking = false;

function onScroll() {
  const sy = window.scrollY;

  // Nav hide/show
  if (sy > nav.offsetHeight + 20) {
    if (sy > lastScrollY) {
      nav.classList.add('hidden');
    } else {
      nav.classList.remove('hidden');
    }
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('hidden', 'scrolled');
  }

  // Scroll indicator fade
  if (sy > 60) {
    scrollIndicator.classList.add('hidden');
  } else {
    scrollIndicator.classList.remove('hidden');
  }

  lastScrollY = sy;
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(onScroll);
    ticking = true;
  }
}, { passive: true });

// =============================================
// Initialize
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('heroCanvas');
  if (canvas) {
    createSideRays(canvas);
  }
});

// =============================================
// Before / After Comparison Slider
// =============================================

(function () {
  const wrapper = document.getElementById('comparisonWrapper');
  if (!wrapper) return;

  const topLayer = document.getElementById('comparisonTop');
  const handle = document.getElementById('comparisonHandle');
  let isDragging = false;

  function setPosition(clientX) {
    const rect = wrapper.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    const leftPct = (pct * 100) + '%';
    const rightPct = ((1 - pct) * 100) + '%';
    topLayer.style.clipPath = 'inset(0 ' + rightPct + ' 0 0)';
    handle.style.left = leftPct;
  }

  function onDown(e) {
    isDragging = true;
    wrapper.classList.add('is-dragging');
    setPosition(e.clientX ?? e.touches[0].clientX);
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    setPosition(e.clientX ?? e.touches[0].clientX);
  }

  function onUp() {
    isDragging = false;
    wrapper.classList.remove('is-dragging');
  }

  // Mouse
  wrapper.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  // Touch
  wrapper.addEventListener('touchstart', onDown, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
})();

// =============================================
// Image Protection
// =============================================
(function() {
  'use strict';

  // Toast message element
  var toast = document.createElement('div');
  toast.className = 'protect-toast';
  toast.textContent = '作品保护中';
  document.body.appendChild(toast);

  var timer = null;

  function showToast(e) {
    toast.classList.add('is-visible');
    var x = e.clientX ?? (e.touches && e.touches[0].clientX);
    var y = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (typeof x === 'number' && typeof y === 'number') {
      toast.style.left = x + 'px';
      toast.style.top  = (y - 40) + 'px';
    }
    clearTimeout(timer);
    timer = setTimeout(function() {
      toast.classList.remove('is-visible');
    }, 1800);
  }

  // Prevent right-click on images
  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      showToast(e);
    }
  });

  // Prevent long-press save on mobile
  document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'IMG' && e.touches.length === 1) {
      var target = e.target;
      var longPressTimer = setTimeout(function() {
        var ev = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        showToast(ev);
        // Prevent the native context menu
        target.style.webkitTouchCallout = 'none';
      }, 600);
      target.addEventListener('touchend', function() {
        clearTimeout(longPressTimer);
      }, { once: true });
      target.addEventListener('touchmove', function() {
        clearTimeout(longPressTimer);
      }, { once: true });
    }
  }, { passive: true });

  // Prevent drag on images
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });
})();
