#version 300 es
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
