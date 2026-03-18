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
        visible: false // будем размывать через отдельные pass'ы ниже
        property variant source: shaderSource
        fragmentShader: "qrc:/shaders/thermal_orange_purple.frag.qsb"
    }

    // Сохраняем результат термо-маппинга в текстуру для blur pass'ов.
    ShaderEffectSource {
        id: thermalTex
        anchors.fill: parent
        sourceItem: thermalBase
        hideSource: true
        live: true
    }

    ShaderEffect {
        id: blurH
        anchors.fill: parent
        property variant source: thermalTex
        property real texelX: 1.0 / Math.max(videoOutput.width, 1)
        property real blurScale: 2.0
        fragmentShader: "qrc:/shaders/gauss_blur_h.frag.qsb"
    }

    ShaderEffectSource {
        id: blurHTex
        anchors.fill: parent
        sourceItem: blurH
        hideSource: true
        live: true
    }

    ShaderEffect {
        id: blurV
        anchors.fill: parent
        property variant source: blurHTex
        property real texelY: 1.0 / Math.max(videoOutput.height, 1)
        property real blurScale: 2.0
        fragmentShader: "qrc:/shaders/gauss_blur_v.frag.qsb"
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
