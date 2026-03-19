#version 300 es
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

const float TILE_COLS = 5.0;
const float TILE_ROWS = 5.0;

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
        abs(1.0 / (rayDir.x == 0.0 ? 1e-30 : rayDir.x)),
        abs(1.0 / (rayDir.y == 0.0 ? 1e-30 : rayDir.y))
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

    } else if (v_uv.y < wallTop) {
        // CEILING
        float pY = v_uv.y;
        float rowDist = 0.5 / max(0.5 - pY, 0.0001);

        vec2 worldPos = u_playerPos + rowDist * rayDir;
        vec2 uv = tileUV(u_ceilTileID, worldPos);
        color = texture(u_ceilsTex, uv).rgb;
        color *= 0.8;
        depth = rowDist;

    } else {
        // FLOOR
        float pY = v_uv.y;
        float rowDist = 0.5 / max(pY - 0.5, 0.0001);

        vec2 worldPos = u_playerPos + rowDist * rayDir;
        vec2 uv = tileUV(u_floorTileID, worldPos);
        color = texture(u_floorsTex, uv).rgb;
        depth = rowDist;
    }

    // Distance fog
    float fogFactor = clamp(depth / u_fogDist, 0.0, 1.0);
    color = mix(color, u_fogColor, fogFactor);

    fragColor = vec4(color, 1.0);
    fragDepth = depth;
}
