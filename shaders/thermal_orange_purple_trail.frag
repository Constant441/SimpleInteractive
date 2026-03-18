#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float trailDecay; // ЧАСТЬ uniform-блока (нужно для Vulkan)
    float texelX; // 1/textureWidth (в UV-шаге)
    float texelY; // 1/textureHeight (в UV-шаге)
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
    vec2 px = vec2(texelX, texelY);

    // 3x3 blur kernel (approx Gaussian)
    // [1 2 1]
    // [2 4 2] / 16
    // [1 2 1]
    const float w00 = 1.0, w01 = 2.0, w02 = 1.0;
    const float w10 = 2.0, w11 = 4.0, w12 = 2.0;
    const float w20 = 1.0, w21 = 2.0, w22 = 1.0;
    const float wSum = w00 + w01 + w02 + w10 + w11 + w12 + w20 + w21 + w22;

    vec4 curC = texture(source, qt_TexCoord0);
    float outA = curC.a;

    // Средние интенсивности (в пространстве g после pow), чтобы блюрился именно “термо”
    float gCurAccum = 0.0;
    float gPrevAccum = 0.0;

    // Helper: luma->g (совместимо с base shader)
    // (не выношу в отдельную функцию ради читаемости/минимума)
    vec2 uv = qt_TexCoord0;

    // sample offsets: (-1,0,1)
    vec4 s00 = texture(source, uv + vec2(-px.x, -px.y));
    vec4 s01 = texture(source, uv + vec2( 0.0,   -px.y));
    vec4 s02 = texture(source, uv + vec2( px.x, -px.y));

    vec4 s10 = texture(source, uv + vec2(-px.x,  0.0));
    vec4 s11 = texture(source, uv + vec2( 0.0,   0.0));
    vec4 s12 = texture(source, uv + vec2( px.x,  0.0));

    vec4 s20 = texture(source, uv + vec2(-px.x,  px.y));
    vec4 s21 = texture(source, uv + vec2( 0.0,    px.y));
    vec4 s22 = texture(source, uv + vec2( px.x,  px.y));

    vec4 p00 = texture(previous, uv + vec2(-px.x, -px.y));
    vec4 p01 = texture(previous, uv + vec2( 0.0,   -px.y));
    vec4 p02 = texture(previous, uv + vec2( px.x, -px.y));

    vec4 p10 = texture(previous, uv + vec2(-px.x,  0.0));
    vec4 p11 = texture(previous, uv + vec2( 0.0,   0.0));
    vec4 p12 = texture(previous, uv + vec2( px.x,  0.0));

    vec4 p20 = texture(previous, uv + vec2(-px.x,  px.y));
    vec4 p21 = texture(previous, uv + vec2( 0.0,    px.y));
    vec4 p22 = texture(previous, uv + vec2( px.x,  px.y));

    // --- gCur from blurred source ---
    // Un-premultiply each sample by its alpha.
    // alpha видео обычно ~1, но берём безопасно.
    float a00 = max(s00.a, 1e-5), a01 = max(s01.a, 1e-5), a02 = max(s02.a, 1e-5);
    float a10 = max(s10.a, 1e-5), a11 = max(s11.a, 1e-5), a12 = max(s12.a, 1e-5);
    float a20 = max(s20.a, 1e-5), a21 = max(s21.a, 1e-5), a22 = max(s22.a, 1e-5);

    float g00 = dot((s00.rgb / a00), vec3(0.344, 0.5, 0.156));
    float g01 = dot((s01.rgb / a01), vec3(0.344, 0.5, 0.156));
    float g02 = dot((s02.rgb / a02), vec3(0.344, 0.5, 0.156));
    float g10 = dot((s10.rgb / a10), vec3(0.344, 0.5, 0.156));
    float g11 = dot((s11.rgb / a11), vec3(0.344, 0.5, 0.156));
    float g12 = dot((s12.rgb / a12), vec3(0.344, 0.5, 0.156));
    float g20 = dot((s20.rgb / a20), vec3(0.344, 0.5, 0.156));
    float g21 = dot((s21.rgb / a21), vec3(0.344, 0.5, 0.156));
    float g22 = dot((s22.rgb / a22), vec3(0.344, 0.5, 0.156));

    g00 = pow(clamp(g00, 0.0, 1.0), 0.75);
    g01 = pow(clamp(g01, 0.0, 1.0), 0.75);
    g02 = pow(clamp(g02, 0.0, 1.0), 0.75);
    g10 = pow(clamp(g10, 0.0, 1.0), 0.75);
    g11 = pow(clamp(g11, 0.0, 1.0), 0.75);
    g12 = pow(clamp(g12, 0.0, 1.0), 0.75);
    g20 = pow(clamp(g20, 0.0, 1.0), 0.75);
    g21 = pow(clamp(g21, 0.0, 1.0), 0.75);
    g22 = pow(clamp(g22, 0.0, 1.0), 0.75);

    gCurAccum =
        (g00 * w00 + g01 * w01 + g02 * w02 +
         g10 * w10 + g11 * w11 + g12 * w12 +
         g20 * w20 + g21 * w21 + g22 * w22) / wSum;

    // --- gPrev from blurred previous ---
    // previous is already thermal colored, where orange.g = 0.45 => col.g = 0.45 * g
    // so g = col.g / 0.45. Again, previous.rgb comes premultiplied, so divide by alpha.
    float ap00 = max(p00.a, 1e-5), ap01 = max(p01.a, 1e-5), ap02 = max(p02.a, 1e-5);
    float ap10 = max(p10.a, 1e-5), ap11 = max(p11.a, 1e-5), ap12 = max(p12.a, 1e-5);
    float ap20 = max(p20.a, 1e-5), ap21 = max(p21.a, 1e-5), ap22 = max(p22.a, 1e-5);

    float gp00 = (p00.rgb / ap00).g / 0.45;
    float gp01 = (p01.rgb / ap01).g / 0.45;
    float gp02 = (p02.rgb / ap02).g / 0.45;
    float gp10 = (p10.rgb / ap10).g / 0.45;
    float gp11 = (p11.rgb / ap11).g / 0.45;
    float gp12 = (p12.rgb / ap12).g / 0.45;
    float gp20 = (p20.rgb / ap20).g / 0.45;
    float gp21 = (p21.rgb / ap21).g / 0.45;
    float gp22 = (p22.rgb / ap22).g / 0.45;

    gp00 = clamp(gp00, 0.0, 1.0);
    gp01 = clamp(gp01, 0.0, 1.0);
    gp02 = clamp(gp02, 0.0, 1.0);
    gp10 = clamp(gp10, 0.0, 1.0);
    gp11 = clamp(gp11, 0.0, 1.0);
    gp12 = clamp(gp12, 0.0, 1.0);
    gp20 = clamp(gp20, 0.0, 1.0);
    gp21 = clamp(gp21, 0.0, 1.0);
    gp22 = clamp(gp22, 0.0, 1.0);

    gPrevAccum =
        (gp00 * w00 + gp01 * w01 + gp02 * w02 +
         gp10 * w10 + gp11 * w11 + gp12 * w12 +
         gp20 * w20 + gp21 * w21 + gp22 * w22) / wSum;

    // Feedback в пространстве интенсивности, чтобы сохранить палитру.
    float gTrail = clamp(max(gCurAccum, gPrevAccum * trailDecay), 0.0, 1.0);

    vec3 orange = vec3(1.0, 0.45, 0.0);
    vec3 purple = vec3(0.55, 0.0, 1.0);
    vec3 col = mix(purple, orange, gTrail);

    // Возвращаем premultiplied RGB с альфой от текущего видео.
    fragColor = vec4(col * outA, outA) * qt_Opacity;
}

