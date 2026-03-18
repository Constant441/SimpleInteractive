#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float trailDecay; // ЧАСТЬ uniform-блока (нужно для Vulkan)
};

layout(binding = 1) uniform sampler2D source;    // текущий кадр (вход)
layout(binding = 2) uniform sampler2D previous;  // предыдущий результат (feedback)

vec3 thermalMap(vec3 rgb)
{
    // Интенсивность (luma)
    float g = dot(rgb, vec3(0.344, 0.5, 0.156));
    g = clamp(g, 0.0, 1.0);
    g = pow(g, 0.75);

    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 purple = vec3(0.55, 0.0, 1.0);

    // Светлое -> оранжевое, тёмное -> фиолетовое.
    return mix(purple, orange, g);
}

void main()
{
    vec4 cur = texture(source, qt_TexCoord0);
    vec4 prev = texture(previous, qt_TexCoord0);

    // Un-premultiply (ShaderEffectSource обычно даёт premultiplied RGB).
    float aCur = max(cur.a, 1e-5);
    vec3 rgbCur = cur.rgb / aCur;

    // Интенсивность g из текущего кадра (по той же логике, что и в base термо-шейдере).
    float gCur = dot(rgbCur, vec3(0.344, 0.5, 0.156));
    gCur = clamp(gCur, 0.0, 1.0);
    gCur = pow(gCur, 0.75);

    // Интенсивность из предыдущего результата:
    // В base-map: col = mix(purple, orange, g), где
    // purple.g = 0, orange.g = 0.45 => col.g = 0.45 * g
    float aPrev = max(prev.a, 1e-5);
    vec3 rgbPrev = prev.rgb / aPrev;
    float gPrev = rgbPrev.g / 0.45;
    gPrev = clamp(gPrev, 0.0, 1.0);

    // Feedback в пространстве интенсивности, чтобы сохранить палитру (без "розовых" смешиваний RGB).
    float gTrail = clamp(max(gCur, gPrev * trailDecay), 0.0, 1.0);

    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 purple = vec3(0.55, 0.0, 1.0);
    vec3 col = mix(purple, orange, gTrail);

    // Возвращаем premultiplied RGB с альфой от текущего видео.
    fragColor = vec4(col * cur.a, cur.a) * qt_Opacity;
}

