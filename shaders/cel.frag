#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

// Cel: по яркости — одна ступень = один плоский тон. Чёрные участки тоже в один тон (тёмный фиолетовый).
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float numBands;
    float shadowStrength;
};

layout(binding = 1) uniform sampler2D source;

void main()
{
    vec4 p = texture(source, qt_TexCoord0);
    float a = max(p.a, 1e-5);
    vec3 raw = p.rgb / a;

    float value = dot(raw, vec3(0.344, 0.5, 0.156));
    value = clamp(value, 0.0, 1.0);

    float bands = max(floor(numBands), 2.0);
    float stepVal = floor(value * bands + 0.5) / bands;

    // Один плоский цвет на ступень: от тёмно-фиолетового до оранжевого. Чёрные (value≈0) → тот же тёмный тон.
    vec3 darkPurple = vec3(0.25, 0.0, 0.45) * (1.0 - shadowStrength * 0.5);
    vec3 brightOrange = vec3(1.0, 0.45, 0.0);
    vec3 col = mix(darkPurple, brightOrange, stepVal);

    fragColor = vec4(col * a, a) * qt_Opacity;
}
