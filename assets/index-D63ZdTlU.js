var he=Object.defineProperty;var Te=(c,e,o)=>e in c?he(c,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):c[e]=o;var f=(c,e,o)=>Te(c,typeof e!="symbol"?e+"":e,o);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&t(a)}).observe(document,{childList:!0,subtree:!0});function o(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function t(n){if(n.ep)return;n.ep=!0;const i=o(n);fetch(n.href,i)}})();const _e=`#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`,Ee=`#version 300 es
precision highp float;
precision highp usampler2D;
precision highp int;

in vec2 v_uv;
layout(location = 0) out vec4 fragColor;
layout(location = 1) out float fragDepth;

// Camera
uniform vec2 u_playerPos;
uniform vec2 u_playerDir;
uniform vec2 u_cameraPlane;
uniform vec2 u_resolution;

// Map
uniform usampler2D u_mapTex;
uniform vec2 u_mapSize;

// Textures
uniform sampler2D u_wallsTex;
uniform sampler2D u_floorsTex;
uniform sampler2D u_ceilsTex;

// Tile mapping: tile value (0..35) -> tile sheet index (0..24)
uniform float u_tileTextures[36];
uniform float u_floorTileID;
uniform float u_ceilTileID;

// Fog
uniform float u_fogDist;
uniform vec3  u_fogColor;

// Ambient light tint (per-level colour grading)
uniform vec3  u_ambientColor;

// Time (seconds) for animated effects
uniform float u_time;

const float TILE_COLS = 5.0;
const float TILE_ROWS = 5.0;
const float RAY_EPSILON   = 1e-30; // prevents division by zero in DDA
const float FLOOR_EPSILON = 0.0001; // prevents division by zero in floor/ceil rowDist

vec2 tileUV(float tileID, vec2 localUV) {
    float col = mod(tileID, TILE_COLS);
    float row = floor(tileID / TILE_COLS);
    vec2 offset = vec2(col / TILE_COLS, row / TILE_ROWS);
    vec2 scale  = vec2(1.0 / TILE_COLS, 1.0 / TILE_ROWS);
    return offset + fract(localUV) * scale;
}

uint getMapTile(ivec2 pos) {
    if (pos.x < 0 || pos.y < 0 || float(pos.x) >= u_mapSize.x || float(pos.y) >= u_mapSize.y)
        return uint(1);
    vec2 uv = (vec2(pos) + 0.5) / u_mapSize;
    return texture(u_mapTex, uv).r;
}

void main() {
    float screenX = v_uv.x * 2.0 - 1.0;

    vec2 rayDir = u_playerDir + u_cameraPlane * screenX;

    ivec2 mapPos = ivec2(floor(u_playerPos));
    vec2 sideDist;
    vec2 deltaDist = vec2(
        abs(1.0 / (rayDir.x == 0.0 ? RAY_EPSILON : rayDir.x)),
        abs(1.0 / (rayDir.y == 0.0 ? RAY_EPSILON : rayDir.y))
    );
    float perpWallDist = 0.0;
    ivec2 step;
    int side = 0;

    if (rayDir.x < 0.0) {
        step.x = -1;
        sideDist.x = (u_playerPos.x - float(mapPos.x)) * deltaDist.x;
    } else {
        step.x = 1;
        sideDist.x = (float(mapPos.x) + 1.0 - u_playerPos.x) * deltaDist.x;
    }
    if (rayDir.y < 0.0) {
        step.y = -1;
        sideDist.y = (u_playerPos.y - float(mapPos.y)) * deltaDist.y;
    } else {
        step.y = 1;
        sideDist.y = (float(mapPos.y) + 1.0 - u_playerPos.y) * deltaDist.y;
    }

    uint hitTile = uint(0);
    for (int i = 0; i < 64; i++) {
        if (sideDist.x < sideDist.y) {
            sideDist.x += deltaDist.x;
            mapPos.x += step.x;
            side = 0;
        } else {
            sideDist.y += deltaDist.y;
            mapPos.y += step.y;
            side = 1;
        }
        hitTile = getMapTile(mapPos);
        if (hitTile > uint(0)) break;
    }

    if (side == 0) {
        perpWallDist = sideDist.x - deltaDist.x;
    } else {
        perpWallDist = sideDist.y - deltaDist.y;
    }
    perpWallDist = max(perpWallDist, 0.001);

    float lineHeight = u_resolution.y / perpWallDist;
    float wallTop    = 0.5 - (lineHeight * 0.5) / u_resolution.y;
    float wallBottom = 0.5 + (lineHeight * 0.5) / u_resolution.y;

    vec3 color;
    float depth = perpWallDist;

    if (v_uv.y >= wallTop && v_uv.y <= wallBottom) {
        // WALL
        float wallX;
        if (side == 0) {
            wallX = u_playerPos.y + perpWallDist * rayDir.y;
        } else {
            wallX = u_playerPos.x + perpWallDist * rayDir.x;
        }
        wallX = fract(wallX);

        float wallY = (v_uv.y - wallTop) / (wallBottom - wallTop);

        int tileVal = int(hitTile);
        float tileSheetIdx = (tileVal >= 0 && tileVal < 36) ? u_tileTextures[tileVal] : 0.0;

        vec2 uv = tileUV(tileSheetIdx, vec2(wallX, wallY));
        color = texture(u_wallsTex, uv).rgb;

        if (side == 1) color *= 0.6;

        // Exit tile (value 9): pulsing green tint
        if (hitTile == uint(9)) {
            float pulse = 0.5 + 0.5 * sin(u_time * 4.0);
            color = mix(color, vec3(0.0, 1.0, 0.0), pulse * 0.6);
        }

    } else if (v_uv.y < wallTop) {
        // CEILING
        float pY = v_uv.y;
        float rowDist = 0.5 / max(0.5 - pY, FLOOR_EPSILON);

        vec2 worldPos = u_playerPos + rowDist * rayDir;
        vec2 uv = tileUV(u_ceilTileID, worldPos);
        color = texture(u_ceilsTex, uv).rgb;
        color *= 0.8;
        depth = rowDist;

    } else {
        // FLOOR
        float pY = v_uv.y;
        float rowDist = 0.5 / max(pY - 0.5, FLOOR_EPSILON);

        vec2 worldPos = u_playerPos + rowDist * rayDir;
        vec2 uv = tileUV(u_floorTileID, worldPos);
        color = texture(u_floorsTex, uv).rgb;
        depth = rowDist;
    }

    // Distance fog
    float fogFactor = clamp(depth / u_fogDist, 0.0, 1.0);
    color *= u_ambientColor;
    color = mix(color, u_fogColor, fogFactor);

    fragColor = vec4(color, 1.0);
    fragDepth = depth;
}
`,ye=`#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;

void main() {
    v_texcoord = a_texcoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`,xe=`#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_texcoord;
out vec4 fragColor;

uniform sampler2D u_spriteSheet;
uniform float u_monsterType;
uniform float u_currentFrame;
uniform sampler2D u_zBuffer;
uniform float u_spriteDepth;
uniform vec2 u_resolution;

vec2 spriteUV(vec2 localUV, float monsterType, float frame) {
    float uOff = frame       * (1.0 / 7.0);
    float vOff = monsterType * (1.0 / 5.0);
    return vec2(uOff, vOff) + localUV * vec2(1.0 / 7.0, 1.0 / 5.0);
}

void main() {
    // Depth test against Z-buffer
    vec2 screenUV = gl_FragCoord.xy / u_resolution;
    float wallDepth = texture(u_zBuffer, screenUV).r;
    if (u_spriteDepth >= wallDepth) discard;

    vec2 uv = spriteUV(v_texcoord, u_monsterType, u_currentFrame);
    vec4 col = texture(u_spriteSheet, uv);
    if (col.a < 0.1) discard;
    fragColor = col;
}
`,ge=`#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`,ve=`#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;class Re{constructor(e){f(this,"gl");f(this,"width",0);f(this,"height",0);f(this,"_ambientColor",[1,1,1]);f(this,"rcProgram");f(this,"rcQuadVAO");f(this,"spProgram");f(this,"spVAO");f(this,"spVBO");f(this,"blitProgram");f(this,"blitVAO");f(this,"fbo");f(this,"colorTex");f(this,"depthTex");const o=e.getContext("webgl2",{antialias:!1});if(!o)throw new Error("WebGL2 not available");this.gl=o,o.getExtension("EXT_color_buffer_float"),this._initShaders(),this._initQuad(),this._initSpriteVAO(),this._initBlitPass(),this.resize(e.width,e.height)}_compileShader(e,o){const t=this.gl,n=t.createShader(e);if(t.shaderSource(n,o),t.compileShader(n),!t.getShaderParameter(n,t.COMPILE_STATUS))throw new Error(`Shader compile error: ${t.getShaderInfoLog(n)}`);return n}_linkProgram(e,o){const t=this.gl,n=this._compileShader(t.VERTEX_SHADER,e),i=this._compileShader(t.FRAGMENT_SHADER,o),a=t.createProgram();if(t.attachShader(a,n),t.attachShader(a,i),t.linkProgram(a),!t.getProgramParameter(a,t.LINK_STATUS))throw new Error(`Program link error: ${t.getProgramInfoLog(a)}`);return t.deleteShader(n),t.deleteShader(i),a}_initShaders(){this.rcProgram=this._linkProgram(_e,Ee),this.spProgram=this._linkProgram(ye,xe)}_initBlitPass(){const e=this.gl;this.blitProgram=this._linkProgram(ge,ve);const o=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),t=e.createVertexArray();e.bindVertexArray(t);const n=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,n),e.bufferData(e.ARRAY_BUFFER,o,e.STATIC_DRAW);const i=e.getAttribLocation(this.blitProgram,"a_position");e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),this.blitVAO=t}_initQuad(){const e=this.gl,o=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),t=e.createVertexArray();e.bindVertexArray(t);const n=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,n),e.bufferData(e.ARRAY_BUFFER,o,e.STATIC_DRAW);const i=e.getAttribLocation(this.rcProgram,"a_position");e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),this.rcQuadVAO=t}_initSpriteVAO(){const e=this.gl,o=e.createVertexArray();e.bindVertexArray(o);const t=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,4*4*4,e.DYNAMIC_DRAW);const n=e.getAttribLocation(this.spProgram,"a_position"),i=e.getAttribLocation(this.spProgram,"a_texcoord");e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,16,0),e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,16,8),e.bindVertexArray(null),this.spVAO=o,this.spVBO=t}resize(e,o){const t=this.gl;this.width=e,this.height=o,t.viewport(0,0,e,o),this.fbo&&t.deleteFramebuffer(this.fbo),this.colorTex&&t.deleteTexture(this.colorTex),this.depthTex&&t.deleteTexture(this.depthTex),this.fbo=t.createFramebuffer(),t.bindFramebuffer(t.FRAMEBUFFER,this.fbo),this.colorTex=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.colorTex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA8,e,o,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.colorTex,0),this.depthTex=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.depthTex),t.texImage2D(t.TEXTURE_2D,0,t.R32F,e,o,0,t.RED,t.FLOAT,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT1,t.TEXTURE_2D,this.depthTex,0),t.drawBuffers([t.COLOR_ATTACHMENT0,t.COLOR_ATTACHMENT1]);const n=t.checkFramebufferStatus(t.FRAMEBUFFER);n!==t.FRAMEBUFFER_COMPLETE&&console.warn("FBO incomplete:",n),t.bindFramebuffer(t.FRAMEBUFFER,null)}setAmbientColor(e,o,t){this._ambientColor=[e,o,t]}drawWorld(e,o,t,n,i,a=0){const r=this.gl,s=this.rcProgram;r.bindFramebuffer(r.FRAMEBUFFER,this.fbo),r.drawBuffers([r.COLOR_ATTACHMENT0,r.COLOR_ATTACHMENT1]),r.viewport(0,0,this.width,this.height),r.clearColor(0,0,0,1),r.clear(r.COLOR_BUFFER_BIT),r.useProgram(s),r.uniform2f(r.getUniformLocation(s,"u_playerPos"),e.pos[0],e.pos[1]),r.uniform2f(r.getUniformLocation(s,"u_playerDir"),e.dir[0],e.dir[1]),r.uniform2f(r.getUniformLocation(s,"u_cameraPlane"),e.plane[0],e.plane[1]),r.uniform2f(r.getUniformLocation(s,"u_resolution"),this.width,this.height);const u=o.meta.fogColor;r.uniform1f(r.getUniformLocation(s,"u_fogDist"),o.meta.fogDist),r.uniform3f(r.getUniformLocation(s,"u_fogColor"),u[0],u[1],u[2]);const l=this._ambientColor;r.uniform3f(r.getUniformLocation(s,"u_ambientColor"),l[0],l[1],l[2]),r.uniform1f(r.getUniformLocation(s,"u_time"),a),r.uniform2f(r.getUniformLocation(s,"u_mapSize"),o.meta.width,o.meta.height);const m=o.sectors[0];r.uniform1f(r.getUniformLocation(s,"u_floorTileID"),m.floorTileID),r.uniform1f(r.getUniformLocation(s,"u_ceilTileID"),m.ceilTileID);const p=new Float32Array(36);for(const[T,y]of Object.entries(o.tileTextures)){const E=parseInt(T);E>=0&&E<36&&(p[E]=y)}r.uniform1fv(r.getUniformLocation(s,"u_tileTextures"),p),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,o.mapTexture),r.uniform1i(r.getUniformLocation(s,"u_mapTex"),0),r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,t),r.uniform1i(r.getUniformLocation(s,"u_wallsTex"),1),r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,n),r.uniform1i(r.getUniformLocation(s,"u_floorsTex"),2),r.activeTexture(r.TEXTURE3),r.bindTexture(r.TEXTURE_2D,i),r.uniform1i(r.getUniformLocation(s,"u_ceilsTex"),3),r.bindVertexArray(this.rcQuadVAO),r.drawArrays(r.TRIANGLES,0,6),r.bindVertexArray(null),r.bindFramebuffer(r.FRAMEBUFFER,null),r.viewport(0,0,this.width,this.height),r.useProgram(this.blitProgram),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.colorTex),r.uniform1i(r.getUniformLocation(this.blitProgram,"u_tex"),0),r.bindVertexArray(this.blitVAO),r.drawArrays(r.TRIANGLES,0,6),r.bindVertexArray(null)}drawSprites(e,o,t){const n=this.gl,i=this.spProgram,a=this.width,r=this.height,s=[...o].sort((d,h)=>h.distToPlayer-d.distToPlayer);n.useProgram(i),n.enable(n.BLEND),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.depthTex),n.uniform1i(n.getUniformLocation(i,"u_zBuffer"),0),n.activeTexture(n.TEXTURE1),n.bindTexture(n.TEXTURE_2D,t.texture),n.uniform1i(n.getUniformLocation(i,"u_spriteSheet"),1),n.uniform2f(n.getUniformLocation(i,"u_resolution"),a,r);const[u,l]=e.dir,[m,p]=e.plane,[T,y]=e.pos,E=m*l-u*p;if(Math.abs(E)<1e-10)return;const A=1/E;for(const d of s){const h=d.x-T,b=d.y-y,L=A*(l*h-u*b),U=A*(-p*h+m*b);if(U<=.01)continue;const H=a/2*(1+L/U),V=Math.abs(r/U),q=V,ue=H-q/2,fe=H+q/2,me=r/2-V/2,de=r/2+V/2,z=ue/a*2-1,$=fe/a*2-1,K=1-de/r*2,j=1-me/r*2,pe=new Float32Array([z,K,0,1,$,K,1,1,z,j,0,0,$,j,1,0]);n.bindBuffer(n.ARRAY_BUFFER,this.spVBO),n.bufferSubData(n.ARRAY_BUFFER,0,pe),n.uniform1f(n.getUniformLocation(i,"u_monsterType"),d.animator.monsterType),n.uniform1f(n.getUniformLocation(i,"u_currentFrame"),d.animator.currentFrame),n.uniform1f(n.getUniformLocation(i,"u_spriteDepth"),U),n.bindVertexArray(this.spVAO),n.drawArrays(n.TRIANGLE_STRIP,0,4),n.bindVertexArray(null)}n.disable(n.BLEND)}}class v{constructor(e,o,t){f(this,"pos");f(this,"dir");f(this,"plane");f(this,"moveSpeed",3);f(this,"rotSpeed",2);f(this,"mouseSpeed",.002);this.pos=[e,o],this.dir=[Math.cos(t),Math.sin(t)],this.plane=[-Math.sin(t)*.66,Math.cos(t)*.66]}update(e,o,t){const n=t.tiles,[i,a]=this.pos,[r,s]=this.dir;if(o.isDown("KeyW")||o.isDown("Keyw")||o.isDown("ArrowUp")){const l=i+r*this.moveSpeed*e,m=a+s*this.moveSpeed*e;v._passable(n,Math.floor(a),Math.floor(l))&&(this.pos[0]=l),v._passable(n,Math.floor(m),Math.floor(i))&&(this.pos[1]=m)}if(o.isDown("KeyS")||o.isDown("Keys")||o.isDown("ArrowDown")){const l=i-r*this.moveSpeed*e,m=a-s*this.moveSpeed*e;v._passable(n,Math.floor(a),Math.floor(l))&&(this.pos[0]=l),v._passable(n,Math.floor(m),Math.floor(i))&&(this.pos[1]=m)}if(o.isDown("KeyA")||o.isDown("Keya")){const l=i-this.plane[0]*this.moveSpeed*e,m=a-this.plane[1]*this.moveSpeed*e;v._passable(n,Math.floor(a),Math.floor(l))&&(this.pos[0]=l),v._passable(n,Math.floor(m),Math.floor(i))&&(this.pos[1]=m)}if(o.isDown("KeyD")||o.isDown("Keyd")){const l=i+this.plane[0]*this.moveSpeed*e,m=a+this.plane[1]*this.moveSpeed*e;v._passable(n,Math.floor(a),Math.floor(l))&&(this.pos[0]=l),v._passable(n,Math.floor(m),Math.floor(i))&&(this.pos[1]=m)}let u=0;o.isDown("ArrowLeft")&&(u-=this.rotSpeed*e),o.isDown("ArrowRight")&&(u+=this.rotSpeed*e),u+=o.consumeMouseDX()*this.mouseSpeed,u!==0&&this._rotate(u)}_rotate(e){const[o,t]=this.dir,[n,i]=this.plane,a=Math.cos(e),r=Math.sin(e);this.dir[0]=o*a-t*r,this.dir[1]=o*r+t*a,this.plane[0]=n*a-i*r,this.plane[1]=n*r+i*a}static _passable(e,o,t){var i;if(o<0||t<0||o>=e.length||t>=(((i=e[0])==null?void 0:i.length)??0))return!1;const n=e[o][t];return n===0||n===9}}class Ae{constructor(e){f(this,"keys",new Set);f(this,"_mouseDX",0);f(this,"_pointerLocked",!1);f(this,"_mouseClicked",!1);window.addEventListener("keydown",o=>{this.keys.add(o.code),["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Tab"].includes(o.code)&&o.preventDefault()}),window.addEventListener("keyup",o=>{this.keys.delete(o.code)}),e.addEventListener("click",()=>e.requestPointerLock()),e.addEventListener("mousedown",o=>{o.button===0&&this._pointerLocked&&(this._mouseClicked=!0)}),document.addEventListener("pointerlockchange",()=>{this._pointerLocked=document.pointerLockElement===e}),document.addEventListener("mousemove",o=>{this._pointerLocked&&(this._mouseDX+=o.movementX)})}isDown(e){return this.keys.has(e)}consumeMouseDX(){const e=this._mouseDX;return this._mouseDX=0,e}consumeClick(){const e=this._mouseClicked;return this._mouseClicked=!1,e}}class we{constructor(){f(this,"ctx");this.ctx=new AudioContext}resume(){return this.ctx.resume()}playHurt(){const e=this.ctx,o=e.createOscillator(),t=e.createGain();o.connect(t),t.connect(e.destination),o.type="sawtooth",o.frequency.setValueAtTime(140,e.currentTime),o.frequency.exponentialRampToValueAtTime(40,e.currentTime+.3),t.gain.setValueAtTime(.5,e.currentTime),t.gain.exponentialRampToValueAtTime(.001,e.currentTime+.35),o.start(e.currentTime),o.stop(e.currentTime+.35)}playLevelComplete(){const e=this.ctx,o=e.createOscillator(),t=e.createGain();o.connect(t),t.connect(e.destination),o.type="sine",o.frequency.setValueAtTime(440,e.currentTime),o.frequency.exponentialRampToValueAtTime(880,e.currentTime+.4),t.gain.setValueAtTime(.3,e.currentTime),t.gain.exponentialRampToValueAtTime(.001,e.currentTime+.5),o.start(e.currentTime),o.stop(e.currentTime+.5)}playFootstep(){const e=this.ctx,t=Math.ceil(e.sampleRate*.05),n=e.createBuffer(1,t,e.sampleRate),i=n.getChannelData(0);for(let s=0;s<t;s++)i[s]=(Math.random()*2-1)*(1-s/t);const a=e.createBufferSource();a.buffer=n;const r=e.createGain();r.gain.setValueAtTime(.12,e.currentTime),a.connect(r),r.connect(e.destination),a.start(e.currentTime)}playSlash(){const e=this.ctx,o=.12,t=Math.ceil(e.sampleRate*o),n=e.createBuffer(1,t,e.sampleRate),i=n.getChannelData(0);for(let l=0;l<t;l++){const m=l/t;i[l]=(Math.random()*2-1)*Math.exp(-m*18)*(1-m)}const a=e.createBufferSource();a.buffer=n;const r=e.createGain();r.gain.setValueAtTime(.4,e.currentTime);const s=e.createOscillator(),u=e.createGain();s.type="sine",s.frequency.setValueAtTime(800,e.currentTime),s.frequency.exponentialRampToValueAtTime(200,e.currentTime+o),u.gain.setValueAtTime(.25,e.currentTime),u.gain.exponentialRampToValueAtTime(.001,e.currentTime+o),s.connect(u),u.connect(e.destination),a.connect(r),r.connect(e.destination),a.start(e.currentTime),s.start(e.currentTime),a.stop(e.currentTime+o),s.stop(e.currentTime+o)}playMonsterGroan(){const e=this.ctx,o=e.createOscillator(),t=e.createGain();o.connect(t),t.connect(e.destination),o.type="triangle",o.frequency.setValueAtTime(80,e.currentTime),o.frequency.setValueAtTime(55,e.currentTime+.15),o.frequency.setValueAtTime(90,e.currentTime+.3),t.gain.setValueAtTime(.001,e.currentTime),t.gain.linearRampToValueAtTime(.18,e.currentTime+.1),t.gain.exponentialRampToValueAtTime(.001,e.currentTime+.45),o.start(e.currentTime),o.stop(e.currentTime+.45)}}class De{static async load(e,o){const t=await fetch(o);if(!t.ok)throw new Error(`Failed to load map: ${o}`);const n=await t.json(),{tileTextures:i,sectors:a,sprites:r}=n,s={...n.meta};s.ambientColor||(s.ambientColor=[1,1,1]);const u=n.tiles.map(d=>[...d]),l=[];for(let d=0;d<s.height;d++)for(let h=0;h<s.width;h++)u[d][h]===0&&l.push([h,d]);if(l.length<2)throw new Error(`Map ${o} needs at least 2 open tiles`);for(let d=l.length-1;d>0;d--){const h=Math.floor(Math.random()*(d+1));[l[d],l[h]]=[l[h],l[d]]}const[m,p]=l[0];s.spawnPoint={x:m+.5,y:p+.5,angle:Math.random()*Math.PI*2};const[T,y]=l[l.length-1];u[y][T]=9;const E=new Uint8Array(s.width*s.height);for(let d=0;d<s.height;d++)for(let h=0;h<s.width;h++)E[d*s.width+h]=u[d][h];const A=e.createTexture();return e.bindTexture(e.TEXTURE_2D,A),e.texImage2D(e.TEXTURE_2D,0,e.R8UI,s.width,s.height,0,e.RED_INTEGER,e.UNSIGNED_BYTE,E),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),{meta:s,tiles:u,tileTextures:i,sectors:a,sprites:r,tileData:E,mapTexture:A}}}class B{static async load(e,o,t=5,n=5,i){let a;try{a=await new Promise((s,u)=>{const l=new Image;l.onload=()=>s(l),l.onerror=u,l.src=o})}catch{if(i)a=i();else throw new Error(`Failed to load texture: ${o}`)}const r=e.createTexture();return e.bindTexture(e.TEXTURE_2D,r),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.generateMipmap(e.TEXTURE_2D),{texture:r,cols:t,rows:n,tileCount:t*n}}}class Le{static async load(e,o,t){let n;try{n=await new Promise((a,r)=>{const s=new Image;s.onload=()=>a(s),s.onerror=r,s.src=o})}catch{if(t)n=t();else throw new Error(`Failed to load sprite sheet: ${o}`)}const i=e.createTexture();return e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),{texture:i,monsterCount:5,frameCount:7,frameU:1/7,frameV:1/5}}}class M{static wallSheet(){return this._makeSheet(5,5,64,(e,o,t,n)=>{const i=n*37%360;e.fillStyle=`hsl(${i},60%,35%)`,e.fillRect(0,0,64,64),e.strokeStyle="#000",e.lineWidth=3,e.strokeRect(1,1,62,62),e.fillStyle="#fff",e.font="bold 14px monospace",e.textAlign="center",e.textBaseline="middle",e.fillText(String(n),32,32)})}static floorSheet(){return this._makeSheet(5,5,64,(e,o,t,n)=>{const i=20+n*13%40;e.fillStyle=`rgb(${i+10},${i},${i-5})`,e.fillRect(0,0,64,64),e.strokeStyle="#111",e.lineWidth=2,e.strokeRect(1,1,62,62),e.fillStyle="#888",e.font="bold 12px monospace",e.textAlign="center",e.textBaseline="middle",e.fillText(String(n),32,32)})}static ceilSheet(){return this._makeSheet(5,5,64,(e,o,t,n)=>{const i=15+n*11%30;e.fillStyle=`rgb(${i-5},${i},${i+15})`,e.fillRect(0,0,64,64),e.strokeStyle="#0a0a1a",e.lineWidth=2,e.strokeRect(1,1,62,62),e.fillStyle="#aab",e.font="bold 12px monospace",e.textAlign="center",e.textBaseline="middle",e.fillText(String(n),32,32)})}static spriteSheet(){const n=document.createElement("canvas");n.width=7*64,n.height=5*64;const i=n.getContext("2d");i.clearRect(0,0,n.width,n.height);const a=["#f44","#4f4","#44f","#ff4","#f4f"];for(let r=0;r<5;r++)for(let s=0;s<7;s++){const u=s*64,l=r*64;i.clearRect(u,l,64,64),i.fillStyle=a[r],i.beginPath(),i.arc(u+64/2,l+64/2,64/2-4,0,Math.PI*2),i.fill(),i.fillStyle="#000",i.font="bold 16px monospace",i.textAlign="center",i.textBaseline="middle",i.fillText(String(s),u+64/2,l+64/2)}return n}static _makeSheet(e,o,t,n){const i=document.createElement("canvas");i.width=e*t,i.height=o*t;const a=i.getContext("2d");for(let r=0;r<o;r++)for(let s=0;s<e;s++)a.save(),a.translate(s*t,r*t),n(a,s,r,r*e+s),a.restore();return i}}class be{constructor(e,o,t=7){f(this,"monsterType");f(this,"fps");f(this,"frameCount");f(this,"currentFrame",0);f(this,"_elapsed",0);this.monsterType=e,this.fps=o,this.frameCount=t}update(e){this._elapsed+=e;const o=1/this.fps;for(;this._elapsed>=o;)this._elapsed-=o,this.currentFrame=(this.currentFrame+1)%this.frameCount}}const Se=1.5,Pe=8,Ue=.6;class te{constructor(e,o,t,n){f(this,"x");f(this,"y");f(this,"animator");f(this,"distToPlayer",0);f(this,"active",!0);f(this,"playerHit",!1);this.x=e,this.y=o,this.animator=new be(t,n)}update(e,o,t,n){var r;if(!this.active)return;this.animator.update(e);const i=this.x-o,a=this.y-t;if(this.distToPlayer=Math.sqrt(i*i+a*a),this.distToPlayer<Ue){this.active=!1,this.playerHit=!0;return}if(this.distToPlayer<Pe){const s=this.distToPlayer;if(s>.001){const u=(o-this.x)/s,l=(t-this.y)/s,m=Se*e,p=this.x+u*m,T=this.y+l*m,y=n.length,E=((r=n[0])==null?void 0:r.length)??0,A=Math.floor(p),d=Math.floor(this.y);if(A>=0&&A<E&&d>=0&&d<y){const L=n[d][A];(L===0||L===9)&&(this.x=p)}const h=Math.floor(this.x),b=Math.floor(T);if(h>=0&&h<E&&b>=0&&b<y){const L=n[b][h];(L===0||L===9)&&(this.y=T)}}}}}let D,_,oe,S,x=null,w=[],ne,re,ie,se,k=null,W=null;const F=200;let O=0,R=0,G=0,C=0,N=0,X=!1,g=1;const Y=["/maps/level1.wdmap.json","/maps/level2.wdmap.json","/maps/level3.wdmap.json","/maps/level4.wdmap.json","/maps/level5.wdmap.json","/maps/level6.wdmap.json","/maps/level7.wdmap.json","/maps/level8.wdmap.json","/maps/level9.wdmap.json","/maps/level10.wdmap.json"],Me=5,Q=2e3,Z=6e3;function Fe(c){var a;const e=[],o=c.length,t=((a=c[0])==null?void 0:a.length)??0;for(let r=0;r<o;r++)for(let s=0;s<t;s++)c[r][s]===0&&e.push([s,r]);if(e.length===0)return null;const[n,i]=e[Math.floor(Math.random()*e.length)];return new te(n+.5,i+.5,Math.floor(Math.random()*Me),8)}function Ce(c){var p;if(!W)return;const e=W,o=c.tiles,t=o.length,n=((p=o[0])==null?void 0:p.length)??0;if(t===0||n===0)return;const i=F/n,a=F/t;e.clearRect(0,0,F,F);for(let T=0;T<t;T++)for(let y=0;y<n;y++){const E=o[T][y];E===9?e.fillStyle="#00ff00":E===0?e.fillStyle="#222":e.fillStyle="#666",e.fillRect(y*i,T*a,i,a)}const r=Math.max(2,i*.3),s=Math.max(3,i*.4);for(const T of w)e.fillStyle="#ffff00",e.beginPath(),e.arc(T.x*i,T.y*a,r,0,Math.PI*2),e.fill();const u=_.pos[0]*i,l=_.pos[1]*a,m=Math.max(i,a)*1.5;e.strokeStyle="#ff0000",e.lineWidth=1.5,e.beginPath(),e.moveTo(u,l),e.lineTo(u+_.dir[0]*m,l+_.dir[1]*m),e.stroke(),e.fillStyle="#ff0000",e.beginPath(),e.arc(u,l,s,0,Math.PI*2),e.fill()}function Ie(){const c=document.getElementById("hud-compass");if(!c)return;const o=(Math.atan2(_.dir[1],_.dir[0])*180/Math.PI+360)%360,t=["E","NE","N","NW","W","SW","S","SE"],n=Math.round(o/45)%8;c.textContent=t[n]}function ae(c){k&&(k.style.display=c?"block":"none");const e=document.getElementById("hud-compass");e&&(e.style.display=c?"block":"none")}function J(c,e){const o=document.createElement("div");o.id="flash-overlay",o.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;color:#ff0;font-family:monospace;font-size:3rem;text-align:center;z-index:20;pointer-events:none;",o.textContent=c,document.body.appendChild(o),setTimeout(()=>o.remove(),e)}function ee(){const c=document.getElementById("brightness-hud");c&&c.remove();const e=document.createElement("div");e.id="brightness-hud",e.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#ff0;font-family:monospace;font-size:1rem;background:rgba(0,0,0,0.6);padding:4px 12px;border:1px solid #ff0;z-index:10;pointer-events:none;",e.textContent=`Brightness: ${Math.round(g*100)}%`,document.body.appendChild(e),setTimeout(()=>e.remove(),1500)}function le(){R&&(cancelAnimationFrame(R),R=0),document.pointerLockElement&&document.exitPointerLock(),X=!1,x=null,document.getElementById("overlay").style.display="flex",document.getElementById("btn-menu").style.display="none",ae(!1)}function P(c){var m;const e=Math.min((c-O)/1e3,.05);if(O=c,!x||X){R=requestAnimationFrame(P);return}const o=_.pos[0],t=_.pos[1];_.update(e,oe,x),_.pos[0]!==o||_.pos[1]!==t?(C+=e,C>=.4&&(C=0,S.playFootstep())):C=0;const i=Math.floor(_.pos[0]),a=Math.floor(_.pos[1]),r=x.tiles.length,s=((m=x.tiles[0])==null?void 0:m.length)??0;if(a>=0&&a<r&&i>=0&&i<s&&x.tiles[a][i]===9){X=!0,S.playLevelComplete(),G>=Y.length-1?(J("🏆 YOU WIN! 🏆",Z),setTimeout(le,Z)):(J("LEVEL COMPLETE!",Q),setTimeout(()=>ce(G+1),Q)),R=requestAnimationFrame(P);return}for(const p of w)p.update(e,_.pos[0],_.pos[1],x.tiles);for(const p of w)if(p.playerHit){p.playerHit=!1,S.playHurt();const T=Fe(x.tiles);T&&w.push(T)}w=w.filter(p=>p.active),N+=e,N>=3&&(N=0,w.some(p=>p.distToPlayer<8)&&S.playMonsterGroan());const u=x.meta.ambientColor??[1,1,1];D.setAmbientColor(u[0]*g,u[1]*g,u[2]*g);const l=performance.now()/1e3;D.drawWorld(_,x,ne.texture,re.texture,ie.texture,l),D.drawSprites(_,w,se),Ce(x),Ie(),R=requestAnimationFrame(P)}async function ce(c){R&&cancelAnimationFrame(R),X=!1,G=c;const e=await De.load(D.gl,Y[c]);x=e,w=e.sprites.map(n=>new te(n.x,n.y,n.type,n.fps));const o=e.meta.spawnPoint;_=new v(o.x,o.y,o.angle);const t=e.meta.ambientColor??[1,1,1];D.setAmbientColor(t[0]*g,t[1]*g,t[2]*g),document.getElementById("overlay").style.display="none",document.getElementById("btn-menu").style.display="block",ae(!0),O=performance.now(),R=requestAnimationFrame(P)}async function I(c,e){try{const o=await e();return console.log(`✅ Loaded texture: ${c}`),o}catch(o){throw console.warn(`⚠️ Failed to load texture: ${c} —`,o),o}}async function Oe(){const c=document.getElementById("webdoom");c.width=window.innerWidth,c.height=window.innerHeight,D=new Re(c);const e=D.gl,o=document.getElementById("minimap");k=o,o&&(W=o.getContext("2d")),oe=new Ae(c),S=new we,console.log("🎮 WebDoom: loading textures..."),ne=await I("walls.png",()=>B.load(e,"/textures/walls.png",5,5,()=>(console.warn("⚠️ walls.png missing — using placeholder"),M.wallSheet()))),re=await I("floors.png",()=>B.load(e,"/textures/floors.png",5,5,()=>(console.warn("⚠️ floors.png missing — using placeholder"),M.floorSheet()))),ie=await I("ceilings.png",()=>B.load(e,"/textures/ceilings.png",5,5,()=>(console.warn("⚠️ ceilings.png missing — using placeholder"),M.ceilSheet()))),se=await I("sprite_sheet.png",()=>Le.load(e,"/textures/sprite_sheet.png",()=>(console.warn("⚠️ sprite_sheet.png missing — using placeholder"),M.spriteSheet()))),console.log("🎮 WebDoom: all textures loaded, ready to play!");for(let t=0;t<Y.length;t++){const n=document.getElementById(`btn-level${t+1}`);n&&n.addEventListener("click",()=>{S.resume().catch(()=>{}),ce(t).catch(console.error)})}document.getElementById("btn-menu").addEventListener("click",le),window.addEventListener("keydown",t=>{t.code==="Equal"||t.key==="+"?(g=Math.min(2,Math.round((g+.1)*10)/10),ee()):(t.code==="Minus"||t.key==="-")&&(g=Math.max(.1,Math.round((g-.1)*10)/10),ee())}),window.addEventListener("resize",()=>{c.width=window.innerWidth,c.height=window.innerHeight,D.resize(c.width,c.height)}),O=performance.now(),R=requestAnimationFrame(P)}Oe().catch(console.error);
