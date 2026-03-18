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
    property var selectedVideoInput: (mediaDevices.videoInputs.length > 0 ? mediaDevices.videoInputs[0] : mediaDevices.defaultVideoInput)
    // В QML для cameraDevice нет isNull() (это было C++-подобное предположение).
    // Поэтому достаточно проверить, что список videoInputs не пуст.
    property bool hasQmlCamera: mediaDevices.videoInputs.length > 0
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
        // Не обнуляем opacity: для корректного premultiplied alpha лучше оставлять 1.0.
    }

    // Базовый термошейдер (без trail) — используем для диагностики и как fallback.
    ShaderEffect {
        id: thermalBase
        anchors.fill: parent
        property variant source: shaderSource
        fragmentShader: "qrc:/shaders/thermal_orange_purple.frag.qsb"
    }

    // Шейдер с feedback-памятью кадра -> “шлейф”.
    // trailPrev хранит результат предыдущего кадра через recursive ShaderEffectSource.
    // Для диагностики сначала проверяем, что обычный термошейдер работает.
    // Затем включай trail.
    property bool enableTrail: true

    ShaderEffectSource {
        id: trailPrev
        anchors.fill: parent
        sourceItem: trailEffect
        hideSource: true
        live: enableTrail
        recursive: enableTrail
    }

    ShaderEffect {
        id: trailEffect
        anchors.fill: parent
        property variant source: shaderSource
        property variant previous: trailPrev
        property real trailDecay: 0.85
        visible: enableTrail
        opacity: enableTrail ? 1.0 : 0.0

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

    Connections {
        target: mediaDevices
        function onVideoInputsChanged() {
            if (!backendAvailable && hasQmlCamera) {
                // Если бэкенд не работает, а список камер обновился — запускаем QML-камеру.
                qmlCaptureSession.camera.start()
            }
        }
    }
}
