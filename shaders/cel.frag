#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

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

    vec3 col;
    if (stepVal <= 0.0)       col = vec3(0.05, 0.0, 0.2);
    else if (stepVal <= 0.2)  col = vec3(0.25, 0.0, 0.85);
    else if (stepVal <= 0.4)  col = vec3(0.9, 0.2, 0.4);
    else if (stepVal <= 0.6)  col = vec3(1.0, 0.45, 0.0);
    else                      col = vec3(1.0, 0.95, 0.5);
    col *= (1.0 - shadowStrength * (1.0 - stepVal));

    fragColor = vec4(col * a, a) * qt_Opacity;
}
