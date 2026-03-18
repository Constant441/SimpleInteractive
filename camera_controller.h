#pragma once

#include <QObject>
#include <QString>

class QVideoSink;
class QMediaCaptureSession;
class QCamera;

class CameraController : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QObject* videoSink READ videoSink CONSTANT)
    Q_PROPERTY(bool hasCamera READ hasCamera NOTIFY hasCameraChanged)
    Q_PROPERTY(bool running READ running NOTIFY runningChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)

public:
    explicit CameraController(QObject* parent = nullptr);
    ~CameraController() override;

    QObject* videoSink() const;
    bool hasCamera() const;
    QString status() const;

    Q_INVOKABLE void start();
    Q_INVOKABLE void stop();

signals:
    void hasCameraChanged();
    void runningChanged();
    void statusChanged();

private:
    void updateDevices();

private:
    QVideoSink* m_sink = nullptr;
    QMediaCaptureSession* m_session = nullptr;
    QCamera* m_camera = nullptr;
    bool m_hasCamera = false;
    bool m_running = false;
    QString m_status;

public:
    bool running() const;
};

