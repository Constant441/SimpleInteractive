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

    MediaDevices {
        id: mediaDevices
    }

    // Если по какой-то причине C++ backend-контроллер не прокинут в QML,
    // включаем минимальный fallback через чистый QML.
    property var selectedVideoInput: (mediaDevices.videoInputs.length > 0
                                       ? mediaDevices.videoInputs[0]
                                       : mediaDevices.defaultVideoInput)
    property bool hasQmlCamera: selectedVideoInput && !selectedVideoInput.isNull()
    property bool backendAvailable: !!cameraController

    CaptureSession {
        id: qmlCaptureSession
        videoOutput: videoOutput
        camera: Camera {
            id: qmlCamera
            cameraDevice: selectedVideoInput
        }
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

    Component.onCompleted: {
        if (backendAvailable) {
            cameraController.setVideoOutput(videoOutput)
            cameraController.start()
        } else if (hasQmlCamera) {
            // fallback
            qmlCaptureSession.camera.start()
        }
    }
}
