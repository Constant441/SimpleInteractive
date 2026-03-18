#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

// Обязательный uniform-блок для ShaderEffect в Qt Quick.
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
};

// В ShaderEffect по умолчанию используется sampler2D с именем "source".
layout(binding = 1) uniform sampler2D source;

void main()
{
    vec4 p = texture(source, qt_TexCoord0);

    // Лёгкая псевдо-термокамера: превращаем цвет в "интенсивность",
    // затем маппим её на градиент оранжевый -> фиолетовый.
    // Входные цвета в ShaderEffect обычно премультиплицированы, поэтому
    // сначала "распремультиплицируем" (если альфа близка к 0, просто избегаем деления).
    float a = max(p.a, 1e-5);
    vec3 rgb = p.rgb / a;

    float g = dot(rgb, vec3(0.344, 0.5, 0.156)); // luminance (как в примерах Qt)
    g = clamp(g, 0.0, 1.0);

    // Контраст/гамма для более "горячего" вида.
    g = pow(g, 0.75);

    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 purple = vec3(0.55, 0.0, 1.0);
    // Светлые области (g ближе к 1) -> оранжевый.
    // Тёмные области (g ближе к 0) -> фиолетовый.
    vec3 col = mix(purple, orange, g);

    // Поскольку входные цвета от Qt обычно премультиплицированы, делаем выход
    // в премультиплицированном виде.
    fragColor = vec4(col * a, a) * qt_Opacity;
}

