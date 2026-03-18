#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float trailDecay; // ЧАСТЬ uniform-блока (нужно для Vulkan)
    float motionThreshold;
    float motionWidth;
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

    vec3 mapped = thermalMap(rgb); // thermal-map текущего кадра

    // Оценка "движения" через разницу яркости между текущим кадром и предыдущим feedback.
    // Это не optical-flow, но даёт маску движущихся областей (frame differencing).
    float gCur = dot(mapped, vec3(0.344, 0.5, 0.156));
    float gPrev = dot(prev.rgb, vec3(0.344, 0.5, 0.156)); // prev.rgb уже thermal-цвета (premultiplied, но alpha обычно ~1)

    float diff = abs(gCur - gPrev);
    // motionMask в 0..1: около порога diff будет мягко включаться/выключаться
    float motionMask = smoothstep(motionThreshold - motionWidth, motionThreshold + motionWidth, diff);

    vec4 curThermal = vec4(mapped * cur.a, cur.a);

    // Trail добавляем только там, где motionMask=1.
    vec3 trailRgb = prev.rgb * trailDecay;
    vec3 outRgb = mix(curThermal.rgb, curThermal.rgb + trailRgb, motionMask);
    float outA = cur.a;

    outRgb = clamp(outRgb, 0.0, 1.0);

    fragColor = vec4(outRgb, outA) * qt_Opacity;
}

