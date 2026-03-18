#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

// DSO-style Cel: яркость через ступенчатый ramp, базовый цвет умножается на фактор (тень = тот же цвет, темнее).
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float numBands;   // число ступеней (2–4 типично)
    float shadowStrength; // насколько темнее тени (0.2–0.5)
};

layout(binding = 1) uniform sampler2D source;

void main()
{
    vec4 p = texture(source, qt_TexCoord0);
    float a = max(p.a, 1e-5);
    vec3 baseColor = p.rgb / a;

    float value = dot(baseColor, vec3(0.344, 0.5, 0.156));
    value = clamp(value, 0.0, 1.0);

    // Ступенчатый ramp (Color Ramp как в статье): value -> дискретные уровни
    float bands = max(floor(numBands), 2.0);
    float stepVal = floor(value * bands + 0.5) / bands;
    // Тени не в ноль: фактор от shadowStrength до 1.0
    float factor = mix(shadowStrength, 1.0, stepVal);

    vec3 col = baseColor * factor;

    fragColor = vec4(col * a, a) * qt_Opacity;
}
