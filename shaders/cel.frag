#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float texelX;
    float texelY;
    float numBands;
    float edgeThreshold;
};

layout(binding = 1) uniform sampler2D source;

void main()
{
    vec2 uv = qt_TexCoord0;
    vec4 p = texture(source, uv);
    float a = max(p.a, 1e-5);
    vec3 rgb = p.rgb / a;

    // Яркость из уже термо-раскрашенного кадра (orange/purple)
    float g = dot(rgb, vec3(0.344, 0.5, 0.156));
    g = clamp(g, 0.0, 1.0);

    // Cel: постерзация в полосы
    float bands = max(floor(numBands), 2.0);
    float gCel = floor(g * bands + 0.5) / bands;

    // Тот же градиент оранжевый–фиолетовый, но по gCel
    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 purple = vec3(0.55, 0.0, 1.0);
    vec3 col = mix(purple, orange, gCel);

    // Контур: разница с соседями по яркости
    float gL = dot(texture(source, uv + vec2(-texelX, 0.0)).rgb / max(texture(source, uv + vec2(-texelX, 0.0)).a, 1e-5), vec3(0.344, 0.5, 0.156));
    float gR = dot(texture(source, uv + vec2( texelX, 0.0)).rgb / max(texture(source, uv + vec2( texelX, 0.0)).a, 1e-5), vec3(0.344, 0.5, 0.156));
    float gT = dot(texture(source, uv + vec2(0.0, -texelY)).rgb / max(texture(source, uv + vec2(0.0, -texelY)).a, 1e-5), vec3(0.344, 0.5, 0.156));
    float gB = dot(texture(source, uv + vec2(0.0,  texelY)).rgb / max(texture(source, uv + vec2(0.0,  texelY)).a, 1e-5), vec3(0.344, 0.5, 0.156));

    float edge = abs(gR - gL) + abs(gT - gB);
    float outline = 1.0 - smoothstep(edgeThreshold * 0.5, edgeThreshold, edge);

    col = mix(col, vec3(0.0, 0.0, 0.0), outline);

    fragColor = vec4(col * a, a) * qt_Opacity;
}
