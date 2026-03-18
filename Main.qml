import QtQuick
import QtMultimedia

Window {
    width: 800
    height: 600
    visible: true
    title: qsTr("TermoCam - WebCam")

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectFit
    }

    Rectangle {
        anchors.fill: parent
        color: "#000000"
        opacity: cameraController.running ? 0.0 : 0.35
        visible: !cameraController.running
    }

    Text {
        anchors.centerIn: parent
        color: "white"
        font.pixelSize: 18
        style: Text.Raised
        text: cameraController.status
        visible: !cameraController.running || !cameraController.hasCamera
    }

    Component.onCompleted: {
        cameraController.setVideoOutput(videoOutput)
        cameraController.start()
    }
}
