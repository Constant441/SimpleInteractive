import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtMultimedia

Window {
    width: 800
    height: 600
    visible: true
    title: qsTr("TermoCam")

    Rectangle {
        anchors.fill: parent
        color: "#000000"
    }

    // Видео из файла
    MediaPlayer {
        id: mediaPlayer
        source: ""
        videoOutput: videoOutput
        loops: MediaPlayer.Infinite
        onSourceChanged: if (source) play()
    }

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectFit
    }

    ShaderEffectSource {
        id: shaderSource
        anchors.fill: parent
        sourceItem: videoOutput
        hideSource: true
        live: true
    }

    // Только термо-градиент (оранжевый ↔ фиолетовый по яркости)
    ShaderEffect {
        id: thermalBase
        anchors.fill: parent
        property variant source: shaderSource
        fragmentShader: "qrc:/shaders/thermal_orange_purple.frag.qsb"
    }

    FileDialog {
        id: fileDialog
        title: qsTr("Выберите видео")
        nameFilters: [ qsTr("Видео") + " (*.mp4 *.webm *.mkv *.avi *.mov)", qsTr("Все файлы") + " (*)" ]
        onAccepted: mediaPlayer.source = selectedFile
    }

    Button {
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.margins: 12
        text: qsTr("Открыть файл")
        onClicked: fileDialog.open()
    }
}
