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
    }

    ShaderEffect {
        anchors.fill: parent
        property variant source: shaderSource
        fragmentShader: "qrc:/shaders/thermal_orange_purple.frag.qsb"
    }

    Text {
        anchors.centerIn: parent
        color: "white"
        font.pixelSize: 18
        style: Text.Raised
        text: cameraController.status
        visible: !cameraController.running || !cameraController.hasCamera
    }

    Rectangle {
        anchors.fill: parent
        color: "#000000"
        opacity: cameraController.running ? 0.0 : 0.35
        visible: !cameraController.running
    }

    Component.onCompleted: {
        cameraController.setVideoOutput(videoOutput)
        cameraController.start()
    }
}
