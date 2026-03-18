import QtQuick
import QtMultimedia

Window {
    width: 800
    height: 600
    visible: true
    title: qsTr("TermoCam - WebCam")

    Rectangle {
        anchors.fill: parent
        color: "#000000"
    }

    // Исходный видеопоток
    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectFit
    }

    // Передаем кадр из VideoOutput в шейдер (QML ShaderEffect компилируется в .qsb).
    ShaderEffectSource {
        id: shaderSource
        anchors.fill: parent
        sourceItem: videoOutput
        hideSource: true
        live: true
        opacity: 0.0 // только как источник текстуры для шейдеров
    }

    // Шейдер с feedback-памятью кадра -> “шлейф”.
    // trailPrev хранит результат предыдущего кадра через recursive ShaderEffectSource.
    ShaderEffectSource {
        id: trailPrev
        anchors.fill: parent
        sourceItem: trailEffect
        hideSource: true
        live: true
        recursive: true
        opacity: 0.0 // только feedback-текстура
    }

    ShaderEffect {
        id: trailEffect
        anchors.fill: parent
        property variant source: shaderSource
        property variant previous: trailPrev
        property real trailDecay: 0.85

        fragmentShader: "qrc:/shaders/thermal_orange_purple_trail.frag.qsb"
    }

    Rectangle {
        anchors.fill: parent
        color: "#000000"
        opacity: cameraController.running ? 0.0 : 0.35
        visible: !cameraController.running
    }

    Component.onCompleted: {
        if (cameraController) {
            cameraController.setVideoOutput(videoOutput)
            cameraController.start()
        }
    }
}
