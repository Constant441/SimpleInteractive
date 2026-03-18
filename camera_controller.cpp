#include "camera_controller.h"

#include <QCamera>
#include <QCameraDevice>
#include <QMediaCaptureSession>
#include <QMediaDevices>
#include <QVariant>

CameraController::CameraController(QObject* parent)
    : QObject(parent)
{
    m_session = new QMediaCaptureSession(this);

    m_status = tr("Инициализация…");
    updateDevices();
}

CameraController::~CameraController() = default;

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

    if (!m_videoOutput) {
        m_status = tr("VideoOutput не задан (сначала вызови setVideoOutput).");
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
    m_session->setVideoOutput(m_videoOutput);

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

void CameraController::setVideoOutput(QObject* videoOutput)
{
    if (m_videoOutput == videoOutput)
        return;

    m_videoOutput = videoOutput;
    if (!m_videoOutput)
        return;

    // Если камера уже запущена — перезапустим, чтобы preview пересвязался.
    if (m_running) {
        stop();
        start();
    }
}

