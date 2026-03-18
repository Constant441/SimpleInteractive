#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float texelY;   // 1/height
    float blurScale; // масштаб шага в пикселях
};

layout(binding = 1) uniform sampler2D source;

void main()
{
    // Приближение гаусса 5-tap по вертикали: [1 4 6 4 1]/16
    float s = texelY * blurScale;
    vec2 uv = qt_TexCoord0;

    vec4 c0 = texture(source, uv + vec2(0.0, -2.0 * s));
    vec4 c1 = texture(source, uv + vec2(0.0, -1.0 * s));
    vec4 c2 = texture(source, uv);
    vec4 c3 = texture(source, uv + vec2(0.0,  1.0 * s));
    vec4 c4 = texture(source, uv + vec2(0.0,  2.0 * s));

    vec4 sum = (c0 + c4) * (1.0 / 16.0)
             + (c1 + c3) * (4.0 / 16.0)
             + c2 * (6.0 / 16.0);

    fragColor = sum * qt_Opacity;
}

