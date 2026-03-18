#include "camera_controller.h"

#include <QCamera>
#include <QCameraDevice>
#include <QMediaCaptureSession>
#include <QMediaDevices>
#include <QVideoSink>

CameraController::CameraController(QObject* parent)
    : QObject(parent)
{
    m_sink = new QVideoSink(this);
    m_session = new QMediaCaptureSession(this);
    m_session->setVideoSink(m_sink);
    m_status = tr("Инициализация…");
    updateDevices();
}

CameraController::~CameraController() = default;

QObject* CameraController::videoSink() const
{
    return m_sink;
}

bool CameraController::hasCamera() const
{
    return m_hasCamera;
}

bool CameraController::running() const
{
    return m_running;
}

QString CameraController::status() const
{
    return m_status;
}

void CameraController::updateDevices()
{
    const auto devices = QMediaDevices::videoInputs();
    const bool hasDefault = !QMediaDevices::defaultVideoInput().isNull();

    m_hasCamera = !devices.isEmpty() || hasDefault;
    emit hasCameraChanged();
}

void CameraController::start()
{
    stop();

    updateDevices();
    if (!m_hasCamera) {
        m_status = tr("Веб-камера не найдена.");
        emit statusChanged();
        return;
    }

    // Выбираем камеру: сначала первую из списка, иначе defaultVideoInput.
    const auto inputs = QMediaDevices::videoInputs();
    QCameraDevice device =
        (!inputs.isEmpty() ? inputs.front() : QMediaDevices::defaultVideoInput());

    if (device.isNull()) {
        m_status = tr("Веб-камера не найдена (device == null).");
        emit statusChanged();
        return;
    }

    auto* camera = new QCamera(device, this);
    m_camera = camera;
    m_session->setCamera(m_camera);

    connect(m_camera, &QCamera::errorOccurred, this,
            [this](QCamera::Error /*error*/, const QString& errorString) {
        m_status = tr("Ошибка камеры: ") + errorString;
        emit statusChanged();
        if (m_running) {
            m_running = false;
            emit runningChanged();
        }
    });

    m_status = tr("Открываю камеру: ") + device.description();
    emit statusChanged();

    m_camera->start();
    m_status = tr("Камера запущена");
    emit statusChanged();
    m_running = true;
    emit runningChanged();
}

void CameraController::stop()
{
    if (m_camera) {
        m_camera->stop();
        m_camera->deleteLater();
        m_camera = nullptr;
    }

    if (m_hasCamera) {
        m_status = tr("Камера остановлена.");
    } else {
        m_status = tr("Веб-камера не найдена.");
    }
    emit statusChanged();
    if (m_running) {
        m_running = false;
        emit runningChanged();
    }
}

