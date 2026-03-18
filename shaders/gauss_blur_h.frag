#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float texelX;   // 1/width
    float blurScale; // масштаб шага в пикселях
};

layout(binding = 1) uniform sampler2D source;

void main()
{
    // Приближение гаусса 5-tap: [1 4 6 4 1]/16
    float s = texelX * blurScale;
    vec2 uv = qt_TexCoord0;

    vec4 c0 = texture(source, uv + vec2(-2.0 * s, 0.0));
    vec4 c1 = texture(source, uv + vec2(-1.0 * s, 0.0));
    vec4 c2 = texture(source, uv);
    vec4 c3 = texture(source, uv + vec2( 1.0 * s, 0.0));
    vec4 c4 = texture(source, uv + vec2( 2.0 * s, 0.0));

    vec4 sum = (c0 + c4) * (1.0 / 16.0)
             + (c1 + c3) * (4.0 / 16.0)
             + c2 * (6.0 / 16.0);

    // sum уже premultiplied, просто умножаем на qt_Opacity как требует ShaderEffect.
    fragColor = sum * qt_Opacity;
}

