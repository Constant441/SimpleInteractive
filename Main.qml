import QtQuick
import QtMultimedia

Window {
    width: 800
    height: 600
    visible: true
    title: qsTr("TermoCam - WebCam")

    property bool showError: false

    MediaDevices {
        id: mediaDevices
    }

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectFit
    }

    CaptureSession {
        id: captureSession
        videoOutput: videoOutput
        camera: Camera {
            id: camera
            cameraDevice: mediaDevices.defaultVideoInput

            onErrorOccurred: (error, errorString) => {
                statusText.text = qsTr("Ошибка камеры: ") + errorString
                showError = true
            }
        }
    }

    Text {
        id: statusText
        anchors.centerIn: parent
        text: qsTr("Веб-камера не найдена")
        visible: mediaDevices.defaultVideoInput.isNull() || showError
        color: "white"
        font.pixelSize: 18
        style: Text.Raised
    }

    Component.onCompleted: {
        // На некоторых платформах нужно явно стартовать, а не полагаться на active.
        if (mediaDevices.defaultVideoInput && !mediaDevices.defaultVideoInput.isNull())
            captureSession.camera.start()
    }
}
