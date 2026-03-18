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

    // ShaderEffectSource даёт премультиплицированные RGB, но мы используем их как rgb'
    // (алфа у видео обычно 1). Чтобы не ловить деление на 0, подстрахуемся.
    float a = max(cur.a, 1e-5);
    vec3 rgb = cur.rgb / a;

    vec3 mapped = thermalMap(rgb);

    vec4 curThermal = vec4(mapped * cur.a, cur.a);

    // Добавляем текущий кадр поверх “прошлого”, затухая его decay-ом.
    vec3 outRgb = curThermal.rgb + prev.rgb * trailDecay;
    float outA = max(curThermal.a, prev.a);

    outRgb = clamp(outRgb, 0.0, 1.0);

    fragColor = vec4(outRgb, outA) * qt_Opacity;
}

