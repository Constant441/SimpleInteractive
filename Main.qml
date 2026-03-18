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

    // Передаем кадр из VideoOutput в шейдер (QML ShaderEffect компилируется в .qsb).
    ShaderEffectSource {
        id: shaderSource
        anchors.fill: parent
        sourceItem: videoOutput
        hideSource: true
        live: true
        // Не обнуляем opacity: для корректного premultiplied alpha лучше оставлять 1.0.
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
