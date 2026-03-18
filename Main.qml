import QtQuick
import QtQuick.Controls
import QtMultimedia
import TermoCam 1.0

Window {
    width: 800
    height: 600
    visible: true
    title: qsTr("TermoCam - WebCam")

    Rectangle {
        anchors.fill: parent
        color: "#000000"
    }

    // Видео с вырезанным фоном (только силуэт человека). Кадры приходят в videoSink.
    SegmentedVideoItem {
        id: segmentedVideo
        anchors.fill: parent
        sensitivity: 0.35
    }

    MediaDevices {
        id: mediaDevices
    }

    property var selectedVideoInput: (mediaDevices.videoInputs.length > 0 ? mediaDevices.videoInputs[0] : mediaDevices.defaultVideoInput)
    property bool hasQmlCamera: mediaDevices.videoInputs.length > 0
    property bool backendAvailable: !!cameraController

    CaptureSession {
        id: qmlCaptureSession
        videoOutput: segmentedVideo
        camera: Camera {
            id: qmlCamera
            cameraDevice: selectedVideoInput
        }
    }

    ShaderEffectSource {
        id: shaderSource
        anchors.fill: parent
        sourceItem: segmentedVideo
        hideSource: true
        live: true
    }

    // Термо-маппинг (оранжевый–фиолетовый), результат в текстуру для Cel.
    ShaderEffect {
        id: thermalBase
        anchors.fill: parent
        visible: false
        property variant source: shaderSource
        fragmentShader: "qrc:/shaders/thermal_orange_purple.frag.qsb"
    }

    ShaderEffectSource {
        id: thermalTex
        anchors.fill: parent
        sourceItem: thermalBase
        hideSource: true
        live: true
    }

    // Cel (toon) шейдер в стиле DSO: ступенчатая яркость × базовый цвет (тень = тот же цвет, темнее).
    ShaderEffect {
        id: celEffect
        anchors.fill: parent
        property variant source: thermalTex
        property real numBands: 3.0
        property real shadowStrength: 0.35
        fragmentShader: "qrc:/shaders/cel.frag.qsb"
    }

    Component.onCompleted: {
        if (backendAvailable) {
            cameraController.setVideoOutput(segmentedVideo)
            cameraController.start()
        } else if (hasQmlCamera) {
            qmlCaptureSession.camera.start()
        }
    }

    // Кнопка: захватить текущий кадр как фон (выйди из кадра, нажми, затем зайди в кадр).
    Button {
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.margins: 12
        text: segmentedVideo.backgroundCaptured ? qsTr("Обновить фон") : qsTr("Захватить фон")
        onClicked: segmentedVideo.captureBackground()
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
